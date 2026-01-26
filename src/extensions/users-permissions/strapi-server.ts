/**
 * Users-Permissions Plugin Extension
 *
 * Overrides the auth callback controller to enrich JWT tokens
 * with cabinetId, eliminating per-request DB lookups for cabinet resolution.
 *
 * The original login flow:
 *   1. User sends credentials
 *   2. Strapi validates and returns JWT with { id: userId }
 *
 * Enhanced flow:
 *   1. User sends credentials
 *   2. Strapi validates credentials
 *   3. We query the user's cabinet association (same logic as session-auth middleware)
 *   4. Issue JWT with { id: userId, cabinetId: resolvedCabinetId }
 *   5. Return enriched JWT to client
 */

async function resolveCabinetId(strapi: any, userId: number): Promise<number | null> {
  const knex = strapi.db.connection;
  let primaryCabinetId: number | null = null;

  // Check primary cabinet relation (oneToOne: user.cabinet)
  const cabinetLink = await knex('up_users_cabinet_lnk')
    .where('user_id', userId)
    .first()
    .catch(() => null);

  if (cabinetLink) {
    const linkedCabinet = await knex('cabinets')
      .where('id', cabinetLink.cabinet_id)
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

  // If no primary cabinet, check employee cabinet relation (manyToOne: user.cabinet_angajat)
  if (!primaryCabinetId) {
    const angajatLink = await knex('up_users_cabinet_angajat_lnk')
      .where('user_id', userId)
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

  return primaryCabinetId;
}

export default (plugin: any) => {
  // Save reference to the original callback controller
  const originalCallback = plugin.controllers.auth.callback;

  // Override the callback (login) controller
  plugin.controllers.auth.callback = async (ctx: any) => {
    // Call the original callback to perform standard authentication
    await originalCallback(ctx);

    // If login was successful (response body has jwt), enrich the token
    if (ctx.body && ctx.body.jwt && ctx.body.user) {
      try {
        const userId = ctx.body.user.id;
        const cabinetId = await resolveCabinetId(strapi, userId);

        // Issue a new JWT with cabinetId included in the payload
        const newToken = strapi.plugins['users-permissions'].services.jwt.issue({
          id: userId,
          cabinetId: cabinetId,
        });

        ctx.body.jwt = newToken;

        strapi.log.info(
          `[AUTH] Enriched JWT for user ${userId} with cabinetId=${cabinetId}`
        );
      } catch (error) {
        // If enrichment fails, keep the original token (backward compatible)
        strapi.log.warn(
          `[AUTH] Failed to enrich JWT with cabinetId: ${error.message}`
        );
      }
    }
  };

  return plugin;
};
