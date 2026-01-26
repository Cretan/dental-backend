/**
 * doctor router with authentication, cabinet isolation, and RBAC
 * Secured with session-auth middleware, cabinet-isolation policy, and role-check policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::doctor.doctor", {
  config: {
    find: {
      policies: [
        "global::cabinet-isolation",
        {
          name: "global::role-check",
          config: {
            roles: [
              "super_admin",
              "clinic_admin",
              "cabinet_admin",
              "dentist",
              "receptionist",
              "accountant",
              "employee",
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
              "clinic_admin",
              "cabinet_admin",
              "dentist",
              "receptionist",
              "accountant",
              "employee",
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
            roles: ["super_admin", "clinic_admin", "cabinet_admin"],
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
            roles: ["super_admin", "clinic_admin", "cabinet_admin"],
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
            roles: ["super_admin", "clinic_admin", "cabinet_admin"],
          },
        },
      ],
    },
  },
});
