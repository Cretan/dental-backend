/**
 * Audit Log Routes
 * READ-ONLY via API: only find and findOne are allowed.
 * Create/Update/Delete are blocked - logs are created only via lifecycle hooks.
 * Access restricted to super_admin and cabinet_admin roles.
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::audit-log.audit-log", {
  config: {
    find: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: { roles: ["super_admin", "cabinet_admin"] },
        },
      ],
    },
    findOne: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: { roles: ["super_admin", "cabinet_admin"] },
        },
      ],
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
