/**
 * PRODUCTION Cabinet Isolation Middleware
 * Ensures users see only their own cabinet data (published content only)
 *
 * This middleware:
 * 1. Verifies JWT authentication
 * 2. Resolves user's cabinet (handles Strapi v5 draft/publish states)
 * 3. Applies cabinet filtering to all data queries
 *
 * Cabinet filtering is data-driven via the registry in
 * src/config/cabinet-content-types.ts. Adding a new cabinet-isolated
 * content type only requires adding it to that registry.
 *
 * Strapi v5 draft/publish note:
 * - Each content entry has a draft row (publishedAt=null) and a published row
 * - Both share the same document_id
 * - Link tables may reference the draft row's id
 * - We must resolve to the published row for API filtering
 */
import { CABINET_FILTERABLE_URLS } from '../config/cabinet-content-types';

export default (config: Record<string, unknown>, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {

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

    // Resolve authentication and cabinet context.
    // Errors here (JWT, user lookup, cabinet resolution) return 500.
    // Errors from downstream middleware/controllers must NOT be caught here —
    // they must propagate to Strapi's error handler for proper transaction
    // rollback and error formatting.
    try {
      const token = authHeader.substring(7);

      // Verify JWT token
      const decoded = await strapi.plugins["users-permissions"].services.jwt.verify(token);

      // Get basic user info (users don't use draft/publish)
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id },
        populate: { role: true }
      });

      if (!user) {
        strapi.log.warn('Cabinet isolation: User not found for token');
        ctx.status = 401;
        ctx.body = { error: "User not found" };
        return;
      }

      let primaryCabinetId = null;

      // Check if JWT payload already contains cabinetId (enriched tokens)
      if (decoded.cabinetId != null) {
        primaryCabinetId = decoded.cabinetId;
        strapi.log.debug(`[SESSION-AUTH] Using cabinetId from JWT: ${primaryCabinetId}`);
      } else {
        // Fallback: resolve cabinet via link tables (for old tokens without cabinetId)
        strapi.log.debug('[SESSION-AUTH] No cabinetId in JWT, resolving from DB');
        const knex = strapi.db.connection;

        // Check primary cabinet relation (oneToOne: user.cabinet)
        const cabinetLink = await knex('up_users_cabinet_lnk')
          .where('user_id', user.id)
          .first()
          .catch(() => null);

        if (cabinetLink) {
          // cabinetLink.cabinet_id might point to draft or published row
          const linkedCabinet = await knex('cabinets')
            .where('id', cabinetLink.cabinet_id)
            .first();

          if (linkedCabinet) {
            if (linkedCabinet.published_at) {
              // Already the published version
              primaryCabinetId = linkedCabinet.id;
            } else {
              // Draft row - find published version with same document_id
              const publishedCabinet = await knex('cabinets')
                .where('document_id', linkedCabinet.document_id)
                .whereNotNull('published_at')
                .first();

              if (publishedCabinet) {
                primaryCabinetId = publishedCabinet.id;
              }
            }
          }
        }

        // If no primary cabinet, check employee cabinet relation (manyToOne: user.cabinet_angajat)
        if (!primaryCabinetId) {
          const angajatLink = await knex('up_users_cabinet_angajat_lnk')
            .where('user_id', user.id)
            .first()
            .catch(() => null);

          if (angajatLink) {
            const linkedCabinet = await knex('cabinets')
              .where('id', angajatLink.cabinet_id)
              .first();

            if (linkedCabinet) {
              if (linkedCabinet.published_at) {
                primaryCabinetId = linkedCabinet.id;
              } else {
                const publishedCabinet = await knex('cabinets')
                  .where('document_id', linkedCabinet.document_id)
                  .whereNotNull('published_at')
                  .first();

                if (publishedCabinet) {
                  primaryCabinetId = publishedCabinet.id;
                }
              }
            }
          }
        }
      }

      strapi.log.info(`[SESSION-AUTH] User ${user.id} (${user.username}): primaryCabinetId=${primaryCabinetId}`);

      // Store cabinet ID on ctx.state (not on ctx.state.user, which Strapi's auth may overwrite)
      ctx.state.primaryCabinetId = primaryCabinetId;

      // Apply cabinet filtering for list requests (published content only)
      if (primaryCabinetId && ctx.method === "GET" && !ctx.params?.id && user.role?.type !== "super_admin") {
        ctx.query = ctx.query || {};
        ctx.query.filters = ctx.query.filters || {};

        if (ctx.url.includes('/cabinets')) {
          // Show only user's cabinet
          ctx.query.filters.id = { $eq: primaryCabinetId };
        } else {
          // Data-driven cabinet filtering: check against the centralized registry
          const matchesCabinetType = Array.from(CABINET_FILTERABLE_URLS).some(
            (urlFragment) => ctx.url.includes(urlFragment)
          );
          if (matchesCabinetType) {
            ctx.query.filters.cabinet = ctx.query.filters.cabinet || {};
            ctx.query.filters.cabinet.id = { $eq: primaryCabinetId };
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      strapi.log.error('Session-auth middleware error:', message);
      ctx.status = 500;
      ctx.body = { error: "Internal server error" };
      return;
    }

    // Call downstream middleware/controllers OUTSIDE try/catch so errors
    // propagate to Strapi's error handler for proper cleanup and formatting.
    await next();
  };
};
