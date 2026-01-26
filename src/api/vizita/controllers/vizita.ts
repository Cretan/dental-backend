/**
 * vizita controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::vizita.vizita', ({ strapi }) => ({
  /**
   * Create visit with validation
   */
  async create(ctx) {
    const { data } = ctx.request.body;

    // Validation: Required fields
    if (!data.pacient) {
      return ctx.badRequest('Patient is required');
    }

    if (!data.cabinet) {
      return ctx.badRequest('Cabinet is required');
    }

    if (!data.data_programare) {
      return ctx.badRequest('Appointment date is required');
    }

    if (!data.tip_vizita) {
      return ctx.badRequest('Visit type is required');
    }

    // Validation: Verify patient exists
    const patient = await strapi.db.query('api::pacient.pacient').findOne({
      where: { id: data.pacient }
    });
    
    if (!patient) {
      return ctx.badRequest('Patient not found');
    }

    // Validation: Verify cabinet exists
    const cabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
      where: { id: data.cabinet }
    });
    
    if (!cabinet) {
      return ctx.badRequest('Cabinet not found');
    }

    // Validation: Cannot schedule in the past (unless recording a completed/past visit)
    const appointmentDate = new Date(data.data_programare);
    const now = new Date();
    
    if (appointmentDate < now && !['Finalizata', 'Anulata'].includes(data.status_vizita)) {
      return ctx.badRequest('Cannot schedule appointment in the past');
    }

    // Validation: Check for time conflicts
    const duration = data.durata || 60; // Default 60 minutes
    const endTime = new Date(appointmentDate.getTime() + duration * 60000);

    // Find overlapping appointments for the same cabinet
    const conflicts = await strapi.db.query('api::vizita.vizita').findMany({
      where: {
        cabinet: data.cabinet,
        status_vizita: {
          $in: ['Programata', 'Confirmata'] // Only check active appointments
        },
        $or: [
          {
            // New appointment starts during existing appointment
            data_programare: {
              $gte: appointmentDate.toISOString(),
              $lt: endTime.toISOString()
            }
          },
          {
            // Existing appointment starts during new appointment
            $and: [
              {
                data_programare: {
                  $lte: appointmentDate.toISOString()
                }
              }
            ]
          }
        ]
      }
    });

    // More robust conflict check using durata
    for (const existingVisit of conflicts) {
      const existingStart = new Date(existingVisit.data_programare);
      const existingDuration = existingVisit.durata || 60;
      const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

      // Check if times overlap
      if (
        (appointmentDate >= existingStart && appointmentDate < existingEnd) ||
        (endTime > existingStart && endTime <= existingEnd) ||
        (appointmentDate <= existingStart && endTime >= existingEnd)
      ) {
        return ctx.badRequest(
          `Time conflict: Another appointment exists from ${existingStart.toLocaleString()} to ${existingEnd.toLocaleString()}`
        );
      }
    }

    // Auto-set status to Programata if not provided
    if (!data.status_vizita) {
      data.status_vizita = 'Programata';
    }

    // Set default duration if not provided
    if (!data.durata) {
      data.durata = 60;
    }

    // All validations passed - create visit
    try {
      // Strapi v5: super.create returns flat response { data: { id, documentId, ...fields } }
      const response = await super.create(ctx);
      return response;
    } catch (error) {
      strapi.log.error('Visit creation error:', error);
      return ctx.internalServerError('Failed to create visit');
    }
  },

  /**
   * Update visit with validation
   */
  async update(ctx) {
    const { data } = ctx.request.body;
    const { id } = ctx.params;

    // Get current visit first
    const currentVisit = await strapi.db.query('api::vizita.vizita').findOne({
      where: { documentId: id } // Use documentId for Strapi v5
    });

    if (!currentVisit) {
      return ctx.notFound('Visit not found');
    }

    // Validation: If patient is being updated, verify it exists
    if (data.pacient) {
      const patient = await strapi.db.query('api::pacient.pacient').findOne({
        where: { id: data.pacient }
      });
      
      if (!patient) {
        return ctx.badRequest('Patient not found');
      }
    }

    // Validation: If cabinet is being updated, verify it exists
    if (data.cabinet) {
      const cabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
        where: { id: data.cabinet }
      });
      
      if (!cabinet) {
        return ctx.badRequest('Cabinet not found');
      }
    }

    // Validation: If date is being updated, check past and conflicts
    if (data.data_programare) {
      const appointmentDate = new Date(data.data_programare);
      const now = new Date();
      
      const status = data.status_vizita || currentVisit.status_vizita;
      
      if (appointmentDate < now && !['Finalizata', 'Anulata'].includes(status)) {
        return ctx.badRequest('Cannot schedule appointment in the past');
      }

      const cabinetId = data.cabinet || currentVisit.cabinet?.id || currentVisit.cabinet;
      const duration = data.durata || currentVisit.durata || 60;
      const endTime = new Date(appointmentDate.getTime() + duration * 60000);

      // Find overlapping appointments (excluding current one)
      const conflicts = await strapi.db.query('api::vizita.vizita').findMany({
        where: {
          documentId: { $ne: id }, // Exclude current visit using documentId
          cabinet: cabinetId,
          status_vizita: {
            $in: ['Programata', 'Confirmata']
          }
        }
      });

      // Check for time conflicts
      for (const existingVisit of conflicts) {
        const existingStart = new Date(existingVisit.data_programare);
        const existingDuration = existingVisit.durata || 60;
        const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

        if (
          (appointmentDate >= existingStart && appointmentDate < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd) ||
          (appointmentDate <= existingStart && endTime >= existingEnd)
        ) {
          return ctx.badRequest(
            `Time conflict: Another appointment exists from ${existingStart.toLocaleString()} to ${existingEnd.toLocaleString()}`
          );
        }
      }
    }

    // All validations passed - update visit
    try {
      // Strapi v5: super.update returns flat response { data: { id, documentId, ...fields } }
      const response = await super.update(ctx);
      return response;
    } catch (error) {
      strapi.log.error('Visit update error:', error);
      return ctx.internalServerError('Failed to update visit');
    }
  },

  /**
   * Get upcoming visits (future appointments)
   */
  async upcoming(ctx) {
    try {
      const now = new Date().toISOString();
      
      const visits = await strapi.db.query('api::vizita.vizita').findMany({
        where: {
          data_programare: { $gte: now },
          status_vizita: { $in: ['Programata', 'Confirmata'] }
        },
        orderBy: { data_programare: 'asc' },
        populate: ['pacient', 'cabinet'],
        limit: 100
      });

      return visits;
    } catch (error) {
      strapi.log.error('Upcoming visits error:', error);
      return ctx.internalServerError('Failed to fetch upcoming visits');
    }
  },

  /**
   * Get visit history for a specific patient
   */
  async history(ctx) {
    const { patientId } = ctx.params;

    if (!patientId) {
      return ctx.badRequest('Patient ID is required');
    }

    try {
      const visits = await strapi.db.query('api::vizita.vizita').findMany({
        where: {
          pacient: patientId
        },
        orderBy: { data_programare: 'desc' },
        populate: ['cabinet', 'tratamente'],
        limit: 100
      });

      return {
        patientId,
        totalVisits: visits.length,
        visits: visits.map(v => ({
          id: v.id,
          data_programare: v.data_programare,
          tip_vizita: v.tip_vizita,
          status_vizita: v.status_vizita,
          durata: v.durata,
          cabinet: v.cabinet ? {
            id: v.cabinet.id,
            nume_cabinet: v.cabinet.nume_cabinet
          } : null,
          treatmentCount: v.tratamente?.length || 0,
          observatii: v.observatii
        }))
      };
    } catch (error) {
      strapi.log.error('Visit history error:', error);
      return ctx.internalServerError('Failed to fetch visit history');
    }
  },
}));
