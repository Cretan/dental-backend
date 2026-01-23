/**
 * PRODUCTION Cabinet Isolation Middleware
 * Ensures users see only their own cabinet data (published content only)
 *
 * This middleware:
 * 1. Verifies JWT authentication
 * 2. Resolves user's cabinet (handles draft/publish states)
 * 3. Applies cabinet filtering to all data queries
 */
export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<any>) => {

    // Skip admin and auth routes
    if (ctx.url.startsWith('/admin') || ctx.url.startsWith('/api/auth')) {
      await next();
      return;
    }

    // Only for API routes
    if (!ctx.url.startsWith('/api/')) {
      await next();
      return;
    }

    // Check authentication token
    const authHeader = ctx.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      await next();
      return;
    }

    try {
      const token = authHeader.substring(7);

      // Verify JWT token
      const decoded = await strapi.plugins["users-permissions"].services.jwt.verify(token);

      // Get user with cabinet relations
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id },
        populate: ['role', 'cabinet', 'cabinet_angajat']
      });

      if (!user) {
        strapi.log.warn('Cabinet isolation: User not found for token');
        ctx.status = 401;
        ctx.body = { error: "User not found" };
        return;
      }

      // Smart cabinet detection: Handle Strapi draft/publish system
      let primaryCabinetId = null;

      if (user.cabinet && user.cabinet.id) {
        if (user.cabinet.publishedAt) {
          // User has direct link to published cabinet
          primaryCabinetId = user.cabinet.id;
        } else {
          // User has link to draft - find published version by name
          const publishedCabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
            where: {
              nume_cabinet: user.cabinet.nume_cabinet,
              publishedAt: { $ne: null }
            }
          });

          if (publishedCabinet) {
            primaryCabinetId = publishedCabinet.id;
          }
        }
      } else if (user.cabinet_angajat) {
        // Handle employee cabinet relations with draft/publish logic
        let employeeCabinet = null;
        if (Array.isArray(user.cabinet_angajat) && user.cabinet_angajat.length > 0) {
          employeeCabinet = user.cabinet_angajat[0];
        } else if (user.cabinet_angajat.id) {
          employeeCabinet = user.cabinet_angajat;
        }

        if (employeeCabinet) {
          if (employeeCabinet.publishedAt) {
            primaryCabinetId = employeeCabinet.id;
          } else {
            // Find published version of employee cabinet
            const publishedCabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
              where: {
                nume_cabinet: employeeCabinet.nume_cabinet,
                publishedAt: { $ne: null }
              }
            });

            if (publishedCabinet) {
              primaryCabinetId = publishedCabinet.id;
            }
          }
        }
      }

      // Enhance user context
      ctx.state.user = {
        ...user,
        primaryCabinetId
      };

      // Apply cabinet filtering for list requests (published content only)
      if (primaryCabinetId && ctx.method === "GET" && !ctx.params?.id && user.role?.type !== "Super Admin") {
        ctx.query = ctx.query || {};
        ctx.query.filters = ctx.query.filters || {};

        if (ctx.url.includes('/cabinets')) {
          // Show only user's cabinet
          ctx.query.filters.id = { $eq: primaryCabinetId };
        } else if (ctx.url.includes('/pacients') || ctx.url.includes('/vizitas') ||
                   ctx.url.includes('/plan-trataments') || ctx.url.includes('/price-lists')) {
          // Filter by cabinet relation
          ctx.query.filters.cabinet = ctx.query.filters.cabinet || {};
          ctx.query.filters.cabinet.id = { $eq: primaryCabinetId };
        }
      }

      await next();

    } catch (error) {
      // Log error but continue - don't expose internal errors
      strapi.log.error('Cabinet isolation middleware error:', error.message);
      await next();
    }
  };
};
