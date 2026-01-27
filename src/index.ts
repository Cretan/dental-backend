import policies from './policies';
import bootstrapRoles from './bootstrap-roles';
import { bootstrapIndexes } from './bootstrap-indexes';
import { validateEnv } from './utils/env-validator';
import { setupGracefulShutdown } from './utils/graceful-shutdown';
import { createHealthCheckMiddleware } from './middlewares/health-check';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // Validate required environment variables before proceeding
    validateEnv();

    // Register health check endpoint (runs before middleware chain, no auth required)
    strapi.server.use(createHealthCheckMiddleware(strapi));

    // Register policies
    Object.entries(policies).forEach(([name, policy]) => {
      strapi.policy(name, policy);
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Bootstrap RBAC roles
    await bootstrapRoles(strapi);

    // Create database indexes for performance optimization
    // Wrapped in try/catch so index failures don't prevent startup
    try {
      await bootstrapIndexes(strapi);
    } catch (error) {
      strapi.log.warn(
        '[BOOTSTRAP] Database index creation failed (non-fatal):',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Register graceful shutdown handlers (after all setup is complete)
    setupGracefulShutdown(strapi);
  },
};
