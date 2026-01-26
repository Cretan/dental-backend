/**
 * Role-Check Policy for RBAC
 *
 * Checks if the authenticated user's role is in the list of allowed roles.
 * Super admin always passes. Returns 403 if role not authorized.
 *
 * Usage in route config:
 *   { name: "global::role-check", config: { roles: ["super_admin", "cabinet_admin", "dentist"] } }
 */

interface PolicyConfig {
  roles?: string[];
}

interface PolicyContext {
  state: {
    user?: {
      id: number;
      role?: { type: string; name: string };
    };
  };
  status?: number;
  body?: Record<string, unknown>;
}

export default (
  policyContext: PolicyContext,
  config: PolicyConfig,
  { strapi }: { strapi: any }
): boolean => {
  const user = policyContext.state?.user;

  // No user means unauthenticated - let auth middleware handle it
  if (!user) {
    return false;
  }

  // Extract role type from user
  const roleType: string | undefined = user.role?.type;

  if (!roleType) {
    strapi.log.warn(
      `[ROLE-CHECK] User ${user.id} has no role assigned, denying access`
    );
    policyContext.status = 403;
    policyContext.body = {
      error: "Forbidden",
      message: "Nu aveti un rol atribuit.",
    };
    return false;
  }

  // Super admin always passes
  if (roleType === "super_admin") {
    strapi.log.debug(
      `[ROLE-CHECK] Super admin (user ${user.id}) - access granted`
    );
    return true;
  }

  // Check if the user's role is in the allowed roles list
  const allowedRoles: string[] = config?.roles || [];

  if (allowedRoles.length === 0) {
    // No roles configured means no restriction (open to all authenticated)
    strapi.log.debug(
      `[ROLE-CHECK] No roles configured, allowing access for user ${user.id}`
    );
    return true;
  }

  if (allowedRoles.includes(roleType)) {
    strapi.log.debug(
      `[ROLE-CHECK] User ${user.id} with role "${roleType}" - access granted`
    );
    return true;
  }

  strapi.log.warn(
    `[ROLE-CHECK] User ${user.id} with role "${roleType}" denied. Required: [${allowedRoles.join(", ")}]`
  );
  policyContext.status = 403;
  policyContext.body = {
    error: "Forbidden",
    message: "Nu aveti permisiunile necesare pentru aceasta actiune.",
  };
  return false;
};
