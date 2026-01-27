/**
 * radiografie controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::radiografie.radiografie', ({ strapi }) => ({
  /**
   * Create radiografie with validation
   */
  async create(ctx) {
    const { data } = ctx.request.body;

    if (!data?.pacient) {
      return ctx.badRequest('Patient is required for radiografie');
    }

    if (!data?.tip_radiografie) {
      return ctx.badRequest('Radiografie type is required');
    }

    if (!data?.data_radiografie) {
      return ctx.badRequest('Radiografie date is required');
    }

    try {
      const response = await super.create(ctx);
      return response;
    } catch (error) {
      strapi.log.error('Radiografie creation error:', error);
      return ctx.internalServerError('Failed to create radiografie');
    }
  },

  /**
   * Update radiografie with error handling
   */
  async update(ctx) {
    try {
      const response = await super.update(ctx);
      return response;
    } catch (error) {
      strapi.log.error('Radiografie update error:', error);
      return ctx.internalServerError('Failed to update radiografie');
    }
  },
}));
