/**
 * plan-tratament controller
 */

import { factories } from '@strapi/strapi';

// Helper function to add "dinte_" prefix to tooth numbers
const addDintePrefix = (numarDinte: string | null | undefined): string | null => {
  if (!numarDinte) return null;
  // If already has prefix, return as is
  if (numarDinte.startsWith('dinte_')) return numarDinte;
  // Add prefix
  return `dinte_${numarDinte}`;
};

// Helper function to remove "dinte_" prefix from tooth numbers
const removeDintePrefix = (numarDinte: string | null | undefined): string | null => {
  if (!numarDinte) return null;
  // Remove prefix if present
  if (numarDinte.startsWith('dinte_')) {
    return numarDinte.substring(6); // Remove "dinte_"
  }
  return numarDinte;
};

// Transform tratamente array: add prefix to numar_dinte
const transformTratamenteForDB = (tratamente: any[]): any[] => {
  return tratamente.map(t => ({
    ...t,
    numar_dinte: addDintePrefix(t.numar_dinte)
  }));
};

// Transform tratamente array: remove prefix from numar_dinte
const transformTratamenteForFrontend = (tratamente: any[]): any[] => {
  if (!tratamente) return [];
  return tratamente.map(t => ({
    ...t,
    numar_dinte: removeDintePrefix(t.numar_dinte)
  }));
};

export default factories.createCoreController('api::plan-tratament.plan-tratament', ({ strapi }) => ({
  /**
   * Override findOne to transform tooth numbers
   */
  async findOne(ctx) {
    const response = await super.findOne(ctx);
    
    // Transform tooth numbers in response
    if (response?.data?.attributes?.tratamente) {
      response.data.attributes.tratamente = transformTratamenteForFrontend(response.data.attributes.tratamente);
    }
    
    return response;
  },

  /**
   * Override find to transform tooth numbers
   */
  async find(ctx) {
    const response = await super.find(ctx);
    
    // Transform tooth numbers in all items
    if (response?.data && Array.isArray(response.data)) {
      response.data.forEach(item => {
        if (item?.attributes?.tratamente) {
          item.attributes.tratamente = transformTratamenteForFrontend(item.attributes.tratamente);
        }
      });
    }
    
    return response;
  },

  /**
   * Create treatment plan with validation
   */
  async create(ctx) {
    try {
      strapi.log.info('=== CREATE CALLED ===');
      
      const { data } = ctx.request.body;

      // DEBUG: Log what we receive
      strapi.log.info('RAW REQUEST BODY:', JSON.stringify(ctx.request.body, null, 2));
      strapi.log.info('DATA.PACIENT TYPE:', typeof data.pacient);
      strapi.log.info('DATA.PACIENT VALUE:', JSON.stringify(data.pacient));

      // Validation: Patient is required
      if (!data.pacient) {
        return ctx.badRequest('Patient is required');
      }

      // Extract relation IDs (Strapi sends them as objects or IDs depending on format)
      const pacientId = typeof data.pacient === 'object' ? data.pacient.id : data.pacient;
      const cabinetId = data.cabinet ? (typeof data.cabinet === 'object' ? data.cabinet.id : data.cabinet) : null;

      strapi.log.info('EXTRACTED PACIENT ID:', pacientId);
      strapi.log.info('EXTRACTED CABINET ID:', cabinetId);

      // Validation: Verify patient exists
      const patient = await strapi.db.query('api::pacient.pacient').findOne({ where: { id: pacientId } });
    
    if (!patient) {
      return ctx.badRequest('Patient not found');
    }

    // Validation: At least one treatment is required
    if (!data.tratamente || !Array.isArray(data.tratamente) || data.tratamente.length === 0) {
      return ctx.badRequest('At least one treatment is required');
    }

    // Validation: Each treatment must have required fields
    for (let i = 0; i < data.tratamente.length; i++) {
      const tratament = data.tratamente[i];
      
      if (!tratament.tip_procedura) {
        return ctx.badRequest(`Treatment ${i + 1}: tip_procedura is required`);
      }
      
      // numar_dinte is optional (some procedures don't apply to specific teeth)
      
      const pret = parseFloat(tratament.pret);
      if (isNaN(pret) || pret < 0) {
        return ctx.badRequest(`Treatment ${i + 1}: pret must be a positive number`);
      }

      // Auto-set status to Planificat if not provided
      if (!tratament.status_tratament) {
        data.tratamente[i].status_tratament = 'Planificat';
      }
    }

    // Transform tooth numbers: add "dinte_" prefix for database
    data.tratamente = transformTratamenteForDB(data.tratamente);

    // Auto-set data_creare if not provided
    if (!data.data_creare) {
      data.data_creare = new Date().toISOString();
    }

    // Auto-calculate pret_total from tratamente
    const pret_total = data.tratamente.reduce((sum, t) => sum + (parseFloat(t.pret) || 0), 0);
    data.pret_total = parseFloat(pret_total.toFixed(2));

    // Debug logging
    strapi.log.info('Creating plan with extracted IDs:', JSON.stringify({
      pacientId,
      cabinetId,
      tratamente_count: data.tratamente?.length,
      tratamente_sample: data.tratamente?.[0],
    }));
    
    // Prepare data for creation
    const createData = {
      data_creare: data.data_creare,
      pret_total: data.pret_total,
      observatii: data.observatii,
      publishedAt: data.publishedAt || new Date().toISOString(),
      pacient: pacientId, // relation as ID
      cabinet: cabinetId, // relation as ID (can be null)
      tratamente: data.tratamente, // components as array
    };
    
    // Use entityService for proper relation handling
    const createdPlan = await strapi.entityService.create('api::plan-tratament.plan-tratament', {
      data: createData,
      populate: ['pacient', 'cabinet', 'tratamente'],
    }) as any;
    
    // Transform tooth numbers: remove "dinte_" prefix for frontend
    if (createdPlan && createdPlan.tratamente) {
      createdPlan.tratamente = transformTratamenteForFrontend(createdPlan.tratamente);
    }
    
    // Return in Strapi v5 format with attributes
    return {
      data: {
        id: createdPlan.id,
        documentId: createdPlan.documentId,
        attributes: createdPlan, // entityService returns flat object
      },
    };
  } catch (error) {
    strapi.log.error('Treatment plan creation error:', error.message || error);
    strapi.log.error('Stack:', error.stack);
    return ctx.internalServerError('Failed to create treatment plan');
  }
  },

  /**
   * Update treatment plan with validation
   */
  async update(ctx) {
    const { data } = ctx.request.body;

    // Validation: If patient is being updated, verify it exists
    if (data.pacient) {
      const patient = await strapi.db.query('api::pacient.pacient').findOne({
        where: { id: data.pacient }
      });
      
      if (!patient) {
        return ctx.badRequest('Patient not found');
      }
    }

    // Validation: If treatments are being updated, validate them
    if (data.tratamente && Array.isArray(data.tratamente)) {
      if (data.tratamente.length === 0) {
        return ctx.badRequest('At least one treatment is required');
      }

      for (let i = 0; i < data.tratamente.length; i++) {
        const tratament = data.tratamente[i];
        
        if (tratament.tip_procedura === null || tratament.tip_procedura === undefined) {
          continue; // Skip validation if field not being updated
        }
        
        if (!tratament.tip_procedura) {
          return ctx.badRequest(`Treatment ${i + 1}: tip_procedura is required`);
        }
        
        if (tratament.pret !== undefined && tratament.pret !== null) {
          const pret = parseFloat(tratament.pret);
          if (isNaN(pret) || pret < 0) {
            return ctx.badRequest(`Treatment ${i + 1}: pret must be a positive number`);
          }
        }

        // Auto-set status to Planificat if not provided
        if (!tratament.status_tratament) {
          data.tratamente[i].status_tratament = 'Planificat';
        }
      }

      // Transform tooth numbers: add "dinte_" prefix for database
      data.tratamente = transformTratamenteForDB(data.tratamente);

      // Auto-calculate pret_total from tratamente
      const pret_total = data.tratamente.reduce((sum, t) => sum + (parseFloat(t.pret) || 0), 0);
      data.pret_total = parseFloat(pret_total.toFixed(2));
    }

    // All validations passed - update plan
    try {
      const response = await super.update(ctx);
      
      // Fetch the full entity with populate to return complete data with updated values
      const { id } = ctx.params;
      const updatedId = response.data?.id || id;
      if (updatedId) {
        const fullEntity = await strapi.db.query('api::plan-tratament.plan-tratament').findOne({
          where: { id: updatedId },
          populate: true,
        });
        
        // Transform tooth numbers: remove "dinte_" prefix for frontend
        if (fullEntity && fullEntity.tratamente) {
          fullEntity.tratamente = transformTratamenteForFrontend(fullEntity.tratamente);
        }
        
        return {
          data: {
            id: updatedId,
            attributes: fullEntity,
          },
        };
      }
      
      return response;
    } catch (error) {
      strapi.log.error('Treatment plan update error:', error);
      return ctx.internalServerError('Failed to update treatment plan');
    }
  },

  /**
   * Get treatment plan summary with statistics
   */
  async summary(ctx) {
    const { id } = ctx.params;

    try {
      // Fetch the treatment plan with patient info
      const plan = await strapi.db.query('api::plan-tratament.plan-tratament').findOne({
        where: { id },
        populate: ['pacient', 'cabinet', 'tratamente']
      });

      if (!plan) {
        return ctx.notFound('Treatment plan not found');
      }

      // Calculate statistics
      const tratamente = plan.tratamente || [];
      const total = tratamente.reduce((sum, t) => sum + (parseFloat(t.pret) || 0), 0);
      
      // Count by status
      const byStatus = tratamente.reduce((acc, t) => {
        const status = t.status_tratament || 'Planificat';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Count by procedure type
      const byType = tratamente.reduce((acc, t) => {
        const type = t.tip_procedura;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      // Average price per treatment
      const averagePrice = tratamente.length > 0 ? total / tratamente.length : 0;

      return {
        plan: {
          id: plan.id,
          data_creare: plan.data_creare,
          observatii: plan.observatii,
        },
        patient: plan.pacient ? {
          id: plan.pacient.id,
          nume: plan.pacient.nume,
          prenume: plan.pacient.prenume,
          cnp: plan.pacient.cnp,
        } : null,
        cabinet: plan.cabinet ? {
          id: plan.cabinet.id,
          nume_cabinet: plan.cabinet.nume_cabinet,
        } : null,
        statistics: {
          totalTreatments: tratamente.length,
          totalPrice: total.toFixed(2),
          averagePrice: averagePrice.toFixed(2),
          byStatus,
          byType,
        },
        treatments: tratamente.map(t => ({
          numar_dinte: removeDintePrefix(t.numar_dinte),
          tip_procedura: t.tip_procedura,
          pret: t.pret,
          status_tratament: t.status_tratament,
          observatii: t.observatii,
        })),
      };
    } catch (error) {
      strapi.log.error('Summary error:', error);
      return ctx.internalServerError('Failed to generate summary');
    }
  },

  /**
   * Calculate treatment plan cost
   * POST /plan-trataments/calculate-cost
   * Body: { tratamente: [...] }
   */
  async calculateCost(ctx) {
    const { tratamente } = ctx.request.body;

    if (!tratamente || !Array.isArray(tratamente) || tratamente.length === 0) {
      return ctx.badRequest('Tratamente array is required');
    }

    try {
      // Calculate subtotal
      const subtotal = tratamente.reduce((sum, tratament) => {
        const pret = parseFloat(tratament.pret) || 0;
        return sum + pret;
      }, 0);

      // Calculate counts by type
      const countsByType = tratamente.reduce((acc, t) => {
        const type = t.tip_procedura;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        treatmentCount: tratamente.length,
        countsByType,
        averagePerTreatment: (subtotal / tratamente.length).toFixed(2),
      };
    } catch (error) {
      strapi.log.error('Calculate cost error:', error);
      return ctx.internalServerError('Failed to calculate cost');
    }
  },

  /**
   * Apply discount to treatment plan
   * POST /plan-trataments/:id/apply-discount
   * Body: { discount_percent: 10 }
   */
  async applyDiscount(ctx) {
    const { id } = ctx.params;
    const { discount_percent } = ctx.request.body;

    if (discount_percent === null || discount_percent === undefined || discount_percent < 0 || discount_percent > 100) {
      return ctx.badRequest('Discount percent must be between 0 and 100');
    }

    try {
      // Get the treatment plan
      const plan = await strapi.db.query('api::plan-tratament.plan-tratament').findOne({
        where: { id },
        populate: ['tratamente']
      });

      if (!plan) {
        return ctx.notFound('Treatment plan not found');
      }

      // Calculate original total
      const tratamente = plan.tratamente || [];
      const subtotal = tratamente.reduce((sum, t) => sum + (parseFloat(t.pret) || 0), 0);

      // Calculate discount
      const discountAmount = (subtotal * discount_percent) / 100;
      const totalAfterDiscount = subtotal - discountAmount;

      // Update the plan with new total
      await strapi.db.query('api::plan-tratament.plan-tratament').update({
        where: { id },
        data: {
          pret_total: parseFloat(totalAfterDiscount.toFixed(2)) // Store as number, not string
        }
      });

      return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount_percent,
        discount_amount: parseFloat(discountAmount.toFixed(2)),
        total: parseFloat(totalAfterDiscount.toFixed(2)),
        savings: parseFloat(discountAmount.toFixed(2)),
      };
    } catch (error) {
      strapi.log.error('Apply discount error:', error);
      return ctx.internalServerError('Failed to apply discount');
    }
  },

  /**
   * Generate invoice for treatment plan
   * POST /plan-trataments/:id/generate-invoice
   * Body: { initial_tratamente: [...] } (optional - for calculating "new" procedures)
   */
  async generateInvoice(ctx) {
    const { id } = ctx.params;
    const { initial_tratamente } = ctx.request.body;

    try {
      // Get the treatment plan with all relations
      const plan = await strapi.db.query('api::plan-tratament.plan-tratament').findOne({
        where: { id },
        populate: ['pacient', 'cabinet', 'tratamente']
      });

      if (!plan) {
        return ctx.notFound('Treatment plan not found');
      }

      const tratamente = plan.tratamente || [];
      
      // Calculate which procedures are "new" (if initial state provided)
      let newProcedures = tratamente;
      if (initial_tratamente && Array.isArray(initial_tratamente)) {
        // Find procedures in current that weren't in initial
        const initialSet = new Set(
          initial_tratamente.map(t => `${t.numar_dinte}_${t.tip_procedura}`)
        );
        newProcedures = tratamente.filter(
          t => !initialSet.has(`${t.numar_dinte}_${t.tip_procedura}`)
        );
      }

      // Calculate totals
      const subtotal = newProcedures.reduce((sum, t) => sum + (parseFloat(t.pret) || 0), 0);
      const total = parseFloat(plan.pret_total) || subtotal;
      const discount = subtotal - total;

      // Group procedures by type
      const proceduresByType = newProcedures.reduce((acc, t) => {
        const type = t.tip_procedura;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push({
          numar_dinte: removeDintePrefix(t.numar_dinte),
          pret: parseFloat(t.pret) || 0,
          observatii: t.observatii
        });
        return acc;
      }, {});

      // Generate invoice data structure
      const invoice = {
        invoice_number: `INV-${plan.id}-${Date.now()}`,
        date: new Date().toISOString(),
        patient: plan.pacient ? {
          nume: plan.pacient.nume,
          prenume: plan.pacient.prenume,
          cnp: plan.pacient.cnp,
        } : null,
        cabinet: plan.cabinet ? {
          nume_cabinet: plan.cabinet.nume_cabinet,
        } : null,
        procedures: proceduresByType,
        summary: {
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: total.toFixed(2),
          procedureCount: newProcedures.length,
        },
        notes: plan.observatii || '',
      };

      return invoice;
    } catch (error) {
      strapi.log.error('Generate invoice error:', error);
      return ctx.internalServerError('Failed to generate invoice');
    }
  },
}));
