/**
 * Factura Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Auto-generates numar_factura per cabinet (incremental)
 * Production-ready implementation
 */

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      strapi.log.warn('Invoice created without authenticated user - added_by not set');
    }

    // Auto-populate data_emitere if not provided
    if (!data.data_emitere) {
      data.data_emitere = new Date().toISOString().split('T')[0];
    }

    // Auto-set status to Draft if not provided
    if (!data.status) {
      data.status = 'Draft';
    }

    // Auto-generate numar_factura per cabinet
    if (!data.numar_factura && data.cabinet) {
      try {
        const cabinetId = typeof data.cabinet === 'object' ? data.cabinet.id : data.cabinet;

        // Find the highest invoice number for this cabinet
        const existingInvoices = await strapi.db.query('api::factura.factura').findMany({
          where: {
            cabinet: cabinetId,
          },
          orderBy: { createdAt: 'desc' },
          limit: 1,
          select: ['numar_factura'],
        });

        let nextNumber = 1;
        if (existingInvoices.length > 0 && existingInvoices[0].numar_factura) {
          // Extract the numeric part from the invoice number (e.g., "F-001" -> 1)
          const match = existingInvoices[0].numar_factura.match(/(\d+)$/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }

        // Format: F-XXXX (zero-padded to 4 digits)
        data.numar_factura = `F-${String(nextNumber).padStart(4, '0')}`;
        strapi.log.info(`[FACTURA] Auto-generated invoice number: ${data.numar_factura} for cabinet ${cabinetId}`);
      } catch (error) {
        strapi.log.error(`[FACTURA] Error generating invoice number: ${error.message}`);
        // Fallback: use timestamp-based number
        data.numar_factura = `F-${Date.now()}`;
      }
    }
  },

  async beforeUpdate(event) {
    // added_by should not be changed after creation
    const { data } = event.params;
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn('Attempt to modify added_by field blocked');
    }
  },
};
