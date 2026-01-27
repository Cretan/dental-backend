/**
 * Health Check Middleware
 *
 * Registered via strapi.server.use() in register() lifecycle,
 * so it runs before the Strapi middleware chain (no auth required).
 *
 * Used by Docker health checks and load balancers.
 * Returns 200 when healthy, 503 when database is unreachable.
 */
export function createHealthCheckMiddleware(strapi: any) {
  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'GET' && ctx.path === '/_health') {
      let dbStatus = 'connected';
      let httpStatus = 200;

      try {
        const knex = strapi.db?.connection;
        if (knex) {
          await knex.raw('SELECT 1');
        } else {
          dbStatus = 'unavailable';
          httpStatus = 503;
        }
      } catch {
        dbStatus = 'disconnected';
        httpStatus = 503;
      }

      ctx.status = httpStatus;
      ctx.body = {
        status: httpStatus === 200 ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        database: dbStatus,
      };
      return;
    }

    await next();
  };
}
