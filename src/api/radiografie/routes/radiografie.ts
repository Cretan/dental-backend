/**
 * radiografie router with authentication, cabinet isolation, and RBAC
 * Secured with session-auth middleware, cabinet-isolation policy, and role-check policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::radiografie.radiografie", {
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
            roles: [
              "super_admin",
              "clinic_admin",
              "cabinet_admin",
              "dentist",
            ],
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
            roles: [
              "super_admin",
              "clinic_admin",
              "cabinet_admin",
              "dentist",
            ],
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
            roles: [
              "super_admin",
              "clinic_admin",
              "cabinet_admin",
            ],
          },
        },
      ],
    },
  },
});
