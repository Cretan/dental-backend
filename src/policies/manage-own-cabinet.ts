export default async (ctx, config, { strapi }) => {
  const user = ctx.state.user;
  const route = ctx.state.route;

  // DEBUG LOGGING - Add this at the very beginning
  strapi.log.info("=== MANAGE-OWN-CABINET POLICY TRIGGERED ===");
  strapi.log.info("Route info:", {
    pluginName: route?.info?.pluginName,
    apiName: route?.info?.apiName,
    type: route?.info?.type,
    path: route?.path,
  });
  strapi.log.info("User:", user?.id, user?.username, user?.email);
  strapi.log.info("===========================================");

  // 1. CRITICAL: DO NOT apply this policy to Users-Permissions plugin routes
  if (route.info.pluginName === "users-permissions") {
    strapi.log.info("Skipping policy for users-permissions plugin");
    return true; // Skip policy, allow Strapi's own user management to work
  }

  // 2. DO NOT apply to login/auth endpoints
  if (route.info.apiName === "auth") {
    strapi.log.info("Skipping policy for auth endpoints");
    return true;
  }

  // 3. Super Admin bypasses
  if (user.role?.name === "Super Admin") {
    strapi.log.info("Super Admin bypass");
    return true;
  }

  // 4. Clinic Admin must have a cabinet for cabinet-scoped actions
  // For non-cabinet-related routes, allow access
  if (!user.cabinet || !user.cabinet.id) {
    // Allow if this is not a cabinet-specific action
    if (!route.path.includes("cabinet")) {
      strapi.log.info(
        "User has no cabinet, but route is not cabinet-specific, returning true"
      );
      return true;
    }
    strapi.log.info("User has no cabinet, returning false");
    return false;
  }

  const userCabinetId = user.cabinet.id;

  // For creating users (only for your custom content types, not users-permissions)
  if (ctx.request.body.cabinet) {
    return ctx.request.body.cabinet == userCabinetId;
  }

  // For updating/deleting (only for your custom content types)
  if (ctx.params.id) {
    try {
      // Use strapi.db.query for users-permissions plugin entities
      // (plugin entities may not be registered in the Document Service)
      const targetUser = await strapi.db.query(
        "plugin::users-permissions.user"
      ).findOne({
        where: { documentId: ctx.params.id },
        populate: ["cabinet"],
      });

      return (
        targetUser &&
        targetUser.cabinet &&
        targetUser.cabinet.id == userCabinetId
      );
    } catch (error) {
      return false;
    }
  }

  return true;
};
