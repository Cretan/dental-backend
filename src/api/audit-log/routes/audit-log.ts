/**
 * Audit Log Routes
 * READ-ONLY via API: only find and findOne are allowed.
 * Create/Update/Delete are blocked - logs are created only via lifecycle hooks.
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::audit-log.audit-log", {
  config: {
    find: {
      policies: ["global::cabinet-isolation"],
    },
    findOne: {
      policies: ["global::cabinet-isolation"],
    },
    create: {
      policies: ["global::deny-all"],
    },
    update: {
      policies: ["global::deny-all"],
    },
    delete: {
      policies: ["global::deny-all"],
    },
  },
});
