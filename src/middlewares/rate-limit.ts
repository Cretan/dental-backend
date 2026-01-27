/**
 * Simple in-memory rate limiter middleware
 * Limits requests per IP address within a time window
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes.
// unref() allows the process to exit naturally (tests, graceful shutdown)
// without waiting for this interval to fire.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();

export default (config: { maxRequests?: number; windowMs?: number } = {}) => {
  const maxRequests = config.maxRequests || 10;
  const windowMs = config.windowMs || 60 * 1000; // 1 minute default

  return async (ctx: any, next: () => Promise<void>) => {
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const now = Date.now();

    let record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requestCounts.set(ip, record);
    } else {
      record.count++;
    }

    // Set rate limit headers
    ctx.set('X-RateLimit-Limit', String(maxRequests));
    ctx.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      ctx.set('Retry-After', String(retryAfterSeconds));
      ctx.status = 429;
      ctx.body = {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfterSeconds,
      };
      return;
    }

    await next();
  };
};
