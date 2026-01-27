/**
 * Health Check Middleware
 *
 * Registered via strapi.server.use() in register() lifecycle,
 * so it runs before the Strapi middleware chain (no auth required).
 *
 * Used by Docker health checks and load balancers.
 * Returns 200 when healthy, 503 when database is unreachable.
 *
 * Includes monitoring metrics: DB response time, memory usage,
 * Node.js version, and environment.
 */
export function createHealthCheckMiddleware(strapi: any) {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'GET' && ctx.path === '/_health') {
      let dbStatus = 'connected';
      let dbResponseTimeMs: number | null = null;
      let httpStatus = 200;

      try {
        const knex = strapi.db?.connection;
        if (knex) {
          const start = performance.now();
          await knex.raw('SELECT 1');
          dbResponseTimeMs = Math.round(performance.now() - start);
        } else {
          dbStatus = 'unavailable';
          httpStatus = 503;
        }
      } catch {
        dbStatus = 'disconnected';
        httpStatus = 503;
      }

      const mem = process.memoryUsage();

      ctx.status = httpStatus;
      ctx.body = {
        status: httpStatus === 200 ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: {
          status: dbStatus,
          responseTimeMs: dbResponseTimeMs,
        },
        memory: {
          rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
          heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        },
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
      };
      return;
    }

    await next();
  };
}
