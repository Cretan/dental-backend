import policies from './policies';
import bootstrapRoles from './bootstrap-roles';
import { bootstrapIndexes } from './bootstrap-indexes';
import { validateEnv } from './utils/env-validator';
import { setupGracefulShutdown } from './utils/graceful-shutdown';
import { createHealthCheckMiddleware } from './middlewares/health-check';
import { CABINET_CONTENT_TYPES } from './config/cabinet-content-types';

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

    // Validate cabinet content-type registry against actual schemas
    try {
      const registeredApiNames = new Set(CABINET_CONTENT_TYPES.map((ct) => ct.apiName));
      const contentTypes = strapi.contentTypes || {};

      // Check: content types with 'cabinet' attribute not in registry (security gap)
      for (const [uid, schema] of Object.entries<any>(contentTypes)) {
        if (!uid.startsWith('api::')) continue;
        const attrs = schema.attributes || {};
        if (attrs.cabinet) {
          const apiName = uid.split('.')[1]; // 'api::pacient.pacient' → 'pacient'
          if (!registeredApiNames.has(apiName)) {
            strapi.log.warn(
              `[CABINET-REGISTRY] Content type '${apiName}' has a 'cabinet' attribute ` +
              `but is NOT registered in cabinet-content-types.ts — cabinet filtering will NOT apply!`
            );
          }
        }
      }

      // Check: registry entries whose content type has no 'cabinet' attribute (stale entry)
      for (const ct of CABINET_CONTENT_TYPES) {
        const uid = `api::${ct.apiName}.${ct.apiName}`;
        const schema = contentTypes[uid];
        if (schema && !schema.attributes?.cabinet) {
          strapi.log.warn(
            `[CABINET-REGISTRY] '${ct.apiName}' is registered in cabinet-content-types.ts ` +
            `but has no 'cabinet' attribute in its schema — stale registry entry?`
          );
        }
      }
    } catch (error) {
      strapi.log.warn(
        '[CABINET-REGISTRY] Validation failed (non-fatal):',
        error instanceof Error ? error.message : String(error)
      );
    }

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
