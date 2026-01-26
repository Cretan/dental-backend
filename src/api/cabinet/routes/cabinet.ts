/**
 * cabinet router with authentication and RBAC
 * Note: cabinet-isolation is handled by session-auth middleware for list filtering.
 * Role-check policy enforces RBAC for cabinet operations.
 */
import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::cabinet.cabinet", {
  config: {
    find: {
      policies: [
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
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin"],
          },
        },
      ],
    },
    update: {
      policies: [
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin", "cabinet_admin"],
          },
        },
      ],
    },
    delete: {
      policies: [
        {
          name: "global::role-check",
          config: {
            roles: ["super_admin"],
          },
        },
      ],
    },
  },
});
