/**
 * pacient router with authentication, cabinet isolation, and RBAC
 * Secured with session-auth middleware, cabinet-isolation policy, and role-check policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::pacient.pacient", {
  config: {
    find: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: [
              "super_admin",
              "cabinet_admin",
              "dentist",
              "receptionist",
              "accountant",
            ],
          },
        },
      ],
    },
    findOne: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: [
              "super_admin",
              "cabinet_admin",
              "dentist",
              "receptionist",
              "accountant",
            ],
          },
        },
      ],
    },
    create: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin", "cabinet_admin", "receptionist"],
          },
        },
      ],
    },
    update: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin", "cabinet_admin", "receptionist"],
          },
        },
      ],
    },
    delete: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin", "cabinet_admin"],
          },
        },
      ],
    },
  },
});
