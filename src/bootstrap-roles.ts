/**
 * Bootstrap script for custom RBAC roles
 *
 * Ensures the required roles exist in the Strapi users-permissions plugin
 * on every application startup. Uses Strapi's built-in role system
 * (up_roles table) rather than creating a custom RBAC system.
 *
 * Roles are created only if they don't already exist (idempotent).
 */

interface RoleDefinition {
  name: string;
  description: string;
  type: string;
}

const ROLES: RoleDefinition[] = [
  {
    name: "Super Admin",
    description: "Full access across all cabinets",
    type: "super_admin",
  },
  {
    name: "Cabinet Admin",
    description: "Full access within their own cabinet",
    type: "cabinet_admin",
  },
  {
    name: "Dentist",
    description:
      "View patients/visits/treatments, create/edit visits and treatment plans, view invoices",
    type: "dentist",
  },
  {
    name: "Receptionist",
    description:
      "Full patient management, create/edit visits, view treatments, view invoices",
    type: "receptionist",
  },
  {
    name: "Accountant",
    description:
      "View all, full invoice/payment management, no treatment editing",
    type: "accountant",
  },
];

export default async function bootstrapRoles(strapi: any): Promise<void> {
  strapi.log.info("[RBAC] Checking custom roles...");

  const pluginStore = strapi.store({
    type: "plugin",
    name: "users-permissions",
  });

  for (const roleDef of ROLES) {
    try {
      // Check if role already exists by type
      const existingRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({
          where: { type: roleDef.type },
        });

      if (existingRole) {
        strapi.log.debug(
          `[RBAC] Role "${roleDef.name}" (type: ${roleDef.type}) already exists (id: ${existingRole.id})`
        );
        continue;
      }

      // Create the role
      await strapi.query("plugin::users-permissions.role").create({
        data: {
          name: roleDef.name,
          description: roleDef.description,
          type: roleDef.type,
        },
      });

      strapi.log.info(
        `[RBAC] Created role "${roleDef.name}" (type: ${roleDef.type})`
      );
    } catch (error: any) {
      strapi.log.error(
        `[RBAC] Error creating role "${roleDef.name}": ${error.message}`
      );
    }
  }

  strapi.log.info("[RBAC] Role bootstrap complete");
}
