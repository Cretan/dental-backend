/**
 * HTTP Request Logger Middleware
 *
 * Logs method, path, status, duration, IP, and user-agent for every request.
 * Skips /_health to avoid noise from Docker health checks (runs every 30s).
 * Log level varies by response status: 5xx=error, 4xx=warn, 2xx/3xx=info.
 */
export default (_config: Record<string, unknown>, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    // Skip health check endpoint to avoid log noise
    if (ctx.path === '/_health') {
      await next();
      return;
    }

    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    const { method, path, status } = ctx;
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const userAgent = ctx.request.header?.['user-agent'] || '-';

    const message = `${method} ${path} ${status} ${duration}ms`;
    const meta = { method, path, status, duration, ip, userAgent };

    if (status >= 500) {
      strapi.log.error(message, meta);
    } else if (status >= 400) {
      strapi.log.warn(message, meta);
    } else {
      strapi.log.info(message, meta);
    }
  };
};
