// import type { Core } from '@strapi/strapi';
import policies from './policies';
import bootstrapRoles from './bootstrap-roles';
import { bootstrapIndexes } from './bootstrap-indexes';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
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
  },
};
