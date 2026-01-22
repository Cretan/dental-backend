export default (ctx, config, { strapi }) => {
  const user = ctx.state.user;

  if (!user) return false; // No user = no access

  // Super Admin bypasses
  if (user.role?.name === "Super Admin") {
    return true;
  }

  // User must have a cabinet
  if (!user.cabinet || !user.cabinet.id) {
    return false;
  }

  const cabinetId = ctx.params.id || ctx.request.body?.id;

  if (!cabinetId) {
    return false;
  }

  // Strict comparison
  return user.cabinet.id === parseInt(cabinetId);
};
