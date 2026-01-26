/**
 * Plata Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Updates invoice status when payment is recorded
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
      strapi.log.warn('Payment created without authenticated user - added_by not set');
    }

    // Auto-populate data_plata if not provided
    if (!data.data_plata) {
      data.data_plata = new Date().toISOString().split('T')[0];
    }
  },

  async afterCreate(event) {
    const { result } = event;
    const { data } = event.params;

    // Update invoice status based on total payments
    const facturaId = data.factura || result.factura?.id || result.factura;
    if (facturaId) {
      await updateInvoiceStatus(facturaId);
    }
  },

  async afterUpdate(event) {
    const { result } = event;
    const { data } = event.params;

    // Update invoice status if payment amount changed
    const facturaId = data.factura || result.factura?.id || result.factura;
    if (facturaId) {
      await updateInvoiceStatus(facturaId);
    }
  },

  async afterDelete(event) {
    const { result } = event;

    // Update invoice status when payment is deleted
    const facturaId = result.factura?.id || result.factura;
    if (facturaId) {
      await updateInvoiceStatus(facturaId);
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

/**
 * Update invoice status based on total payments received
 * - If total payments >= invoice total -> Platita
 * - If total payments > 0 but < invoice total -> Partiala
 * - If no payments -> keep current status (Draft/Emisa)
 */
async function updateInvoiceStatus(facturaId: number | string) {
  try {
    // Get the invoice with its total
    const factura = await strapi.db.query('api::factura.factura').findOne({
      where: { id: facturaId },
      select: ['id', 'total', 'status', 'documentId'],
    });

    if (!factura || factura.status === 'Anulata') {
      return;
    }

    // Get all payments for this invoice
    const payments = await strapi.db.query('api::plata.plata').findMany({
      where: { factura: facturaId },
      select: ['suma'],
    });

    const totalPayments = payments.reduce((sum, payment) => {
      return sum + (parseFloat(String(payment.suma)) || 0);
    }, 0);

    const invoiceTotal = parseFloat(String(factura.total)) || 0;

    let newStatus = factura.status;
    if (totalPayments >= invoiceTotal && invoiceTotal > 0) {
      newStatus = 'Platita';
    } else if (totalPayments > 0) {
      newStatus = 'Partiala';
    }

    // Only update if status changed
    if (newStatus !== factura.status) {
      await strapi.db.query('api::factura.factura').update({
        where: { id: facturaId },
        data: { status: newStatus },
      });

      strapi.log.info(
        `[PLATA] Invoice ${facturaId} status updated: ${factura.status} -> ${newStatus} (paid ${totalPayments}/${invoiceTotal})`
      );
    }
  } catch (error) {
    strapi.log.error(`[PLATA] Error updating invoice status: ${error.message}`);
  }
}
