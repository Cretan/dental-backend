export default async (ctx, config, { strapi }) => {
  const user = ctx.state.user;
  const route = ctx.state.route;

  strapi.log.debug(`[MANAGE-OWN-CABINET] User ${user?.id}, route: ${route?.path}`);

  // 1. CRITICAL: DO NOT apply this policy to Users-Permissions plugin routes
  if (route.info.pluginName === "users-permissions") {
    return true;
  }

  // 2. DO NOT apply to login/auth endpoints
  if (route.info.apiName === "auth") {
    return true;
  }

  // 3. Super Admin bypasses
  if (user.role?.name === "Super Admin") {
    return true;
  }

  // 4. Clinic Admin must have a cabinet for cabinet-scoped actions
  // For non-cabinet-related routes, allow access
  if (!user.cabinet || !user.cabinet.id) {
    // Allow if this is not a cabinet-specific action
    if (!route.path.includes("cabinet")) {
      return true;
    }
    strapi.log.warn(`[MANAGE-OWN-CABINET] User ${user?.id} has no cabinet, denying access`);
    return false;
  }

  const userCabinetId = user.cabinet.id;

  // For creating users (only for your custom content types, not users-permissions)
  if (ctx.request.body.cabinet) {
    return Number(ctx.request.body.cabinet) === Number(userCabinetId);
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
        Number(targetUser.cabinet.id) === Number(userCabinetId)
      );
    } catch (error) {
      return false;
    }
  }

  return true;
};
