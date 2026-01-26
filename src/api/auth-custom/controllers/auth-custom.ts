/**
 * Auth Custom Controller
 *
 * Provides token refresh functionality.
 * Accepts recently-expired tokens (within 24h grace period) and issues
 * new JWT tokens enriched with cabinetId.
 */

import jwt from 'jsonwebtoken';

// Grace period: accept expired tokens up to 24 hours old
const REFRESH_GRACE_PERIOD_SECONDS = 24 * 60 * 60;

/**
 * Resolve the user's primary cabinet ID from link tables.
 * Handles Strapi v5 draft/publish by resolving to published row.
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

  // If no primary cabinet, check employee cabinet relation
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

export default {
  async refresh(ctx) {
    try {
      const authHeader = ctx.request.header.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        return ctx.unauthorized('No token provided');
      }

      // Get the JWT secret from Strapi's users-permissions plugin config
      const jwtSecret = strapi.config.get(
        'plugin::users-permissions.jwtSecret'
      ) || strapi.config.get('plugin.users-permissions.jwtSecret');

      let decoded: any;

      // First, try to verify normally (token still valid)
      try {
        decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (verifyError: any) {
        // If token is expired, decode it without verification and check grace period
        if (verifyError.name === 'TokenExpiredError') {
          // Decode without verification to read payload
          decoded = jwt.decode(token);

          if (!decoded || !decoded.id) {
            return ctx.unauthorized('Invalid token payload');
          }

          // Check if token is within the grace period
          const now = Math.floor(Date.now() / 1000);
          const expiredAt = decoded.exp || 0;
          const expiredDuration = now - expiredAt;

          if (expiredDuration > REFRESH_GRACE_PERIOD_SECONDS) {
            strapi.log.warn(
              `[AUTH-REFRESH] Token expired ${expiredDuration}s ago, beyond grace period of ${REFRESH_GRACE_PERIOD_SECONDS}s`
            );
            return ctx.unauthorized('Token expired beyond refresh window. Please login again.');
          }

          strapi.log.info(
            `[AUTH-REFRESH] Accepting expired token (expired ${expiredDuration}s ago) for user ${decoded.id}`
          );
        } else {
          // Other verification errors (invalid signature, malformed, etc.)
          strapi.log.warn(`[AUTH-REFRESH] Token verification failed: ${verifyError.message}`);
          return ctx.unauthorized('Invalid token');
        }
      }

      if (!decoded || !decoded.id) {
        return ctx.unauthorized('Invalid token payload');
      }

      // Verify user still exists and is not blocked
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id },
        populate: { role: true },
      });

      if (!user) {
        return ctx.unauthorized('User not found');
      }

      if (user.blocked) {
        return ctx.unauthorized('User account is blocked');
      }

      // Resolve cabinetId from DB (always fresh for refresh)
      const cabinetId = await resolveCabinetId(strapi, user.id);

      // Issue new JWT with cabinetId
      const newToken = strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
        cabinetId: cabinetId,
      });

      // Return sanitized user data (without password, tokens, etc.)
      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        confirmed: user.confirmed,
        blocked: user.blocked,
        role: user.role,
      };

      strapi.log.info(
        `[AUTH-REFRESH] Token refreshed for user ${user.id} (${user.username}), cabinetId=${cabinetId}`
      );

      return ctx.send({
        jwt: newToken,
        user: sanitizedUser,
      });
    } catch (error) {
      strapi.log.error(`[AUTH-REFRESH] Token refresh failed: ${error.message}`);
      return ctx.unauthorized('Token refresh failed');
    }
  },
};
