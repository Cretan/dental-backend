/**
 * plan-tratament service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::plan-tratament.plan-tratament', ({ strapi }) => ({
  /**
   * Override create to auto-calculate pret_total
   */
  async create(params) {
    // Calculate total price from treatments
    if (params.data.tratamente && Array.isArray(params.data.tratamente)) {
      const total = params.data.tratamente.reduce((sum, tratament) => {
        const pret = parseFloat(tratament.pret) || 0;
        return sum + pret;
      }, 0);
      params.data.pret_total = total.toFixed(2);
    } else {
      params.data.pret_total = 0;
    }

    // Auto-set creation date if not provided
    if (!params.data.data_creare) {
      params.data.data_creare = new Date().toISOString();
    }

    // Call parent create
    const result = await super.create(params);
    return result;
  },

  /**
   * Override update to auto-calculate pret_total
   */
  async update(entityId, params) {
    // Calculate total price from treatments if they're being updated
    if (params.data.tratamente && Array.isArray(params.data.tratamente)) {
      const total = params.data.tratamente.reduce((sum, tratament) => {
        const pret = parseFloat(tratament.pret) || 0;
        return sum + pret;
      }, 0);
      params.data.pret_total = total.toFixed(2);
    }

    // Call parent update
    const result = await super.update(entityId, params);
    return result;
  },
}));
