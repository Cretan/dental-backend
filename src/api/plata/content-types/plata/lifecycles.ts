/**
 * Plata Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Updates invoice status when payment is recorded
 * Audit logging for create, update, delete operations
 * Data integrity: patient mismatch, archived patient, overpayment prevention
 */

import { errors } from "@strapi/utils";
import { logAuditEvent } from "../../../../utils/audit-logger";

const { ApplicationError } = errors;

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      strapi.log.warn(
        "Payment created without authenticated user - added_by not set"
      );
    }

    // Auto-populate data_plata if not provided
    if (!data.data_plata) {
      data.data_plata = new Date().toISOString().split("T")[0];
    }

    // GAP-6: Block payment creation for archived patients
    if (data.pacient) {
      const patientId =
        typeof data.pacient === "object" ? data.pacient.id : data.pacient;
      if (patientId) {
        const patient = await strapi.db
          .query("api::pacient.pacient")
          .findOne({
            where: { id: patientId },
            select: ["status_pacient"],
          });

        if (patient && patient.status_pacient === "Arhivat") {
          throw new ApplicationError(
            "Cannot create payment for archived patient. Reactivate the patient first."
          );
        }
      }
    }

    // Invoice-related validations (GAP-5, GAP-9)
    if (data.factura) {
      const facturaId =
        typeof data.factura === "object" ? data.factura.id : data.factura;
      if (facturaId) {
        const factura = await strapi.db
          .query("api::factura.factura")
          .findOne({
            where: { id: facturaId },
            select: ["id", "total", "status", "pacient"],
          });

        if (factura) {
          // GAP-9: Block payment to cancelled invoice
          if (factura.status === "Anulata") {
            throw new ApplicationError(
              "Cannot add payment to a cancelled invoice."
            );
          }

          // GAP-5: Check payment patient matches invoice patient
          if (data.pacient && factura.pacient) {
            const paymentPatientId =
              typeof data.pacient === "object"
                ? data.pacient.id
                : data.pacient;
            const knex = strapi.db.connection;
            const invoicePatientLink = await knex("facturas_pacient_lnk")
              .where({ factura_id: facturaId })
              .select("pacient_id")
              .first();

            if (
              invoicePatientLink &&
              invoicePatientLink.pacient_id &&
              String(invoicePatientLink.pacient_id) !==
                String(paymentPatientId)
            ) {
              throw new ApplicationError(
                "Payment patient does not match invoice patient."
              );
            }
          }

          // GAP-9: Overpayment prevention
          const paymentAmount = parseFloat(String(data.suma)) || 0;
          const invoiceTotal = parseFloat(String(factura.total)) || 0;

          if (invoiceTotal > 0) {
            // Sum existing payments for this invoice
            const existingPayments = await strapi.db
              .query("api::plata.plata")
              .findMany({
                where: { factura: facturaId },
                select: ["suma"],
              });

            const totalPaid = existingPayments.reduce(
              (sum, p) => sum + (parseFloat(String(p.suma)) || 0),
              0
            );

            const remaining = invoiceTotal - totalPaid;
            if (paymentAmount > remaining + 0.01) {
              throw new ApplicationError(
                `Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining balance (${remaining.toFixed(2)}).`
              );
            }
          }
        }
      }
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

    // Audit log
    const ctx = strapi.requestContext?.get();
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "plata",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: null,
      date_noi: result,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async afterUpdate(event) {
    const { result } = event;
    const { data } = event.params;

    // Update invoice status if payment amount changed
    const facturaId = data.factura || result.factura?.id || result.factura;
    if (facturaId) {
      await updateInvoiceStatus(facturaId);
    }

    // Audit log
    const ctx = strapi.requestContext?.get();
    await logAuditEvent(strapi, {
      actiune: "Update",
      entitate: "plata",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: null,
      date_noi: data,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async afterDelete(event) {
    const { result } = event;

    // Update invoice status when payment is deleted
    const facturaId = result.factura?.id || result.factura;
    if (facturaId) {
      await updateInvoiceStatus(facturaId);
    }

    // Audit log
    const ctx = strapi.requestContext?.get();
    await logAuditEvent(strapi, {
      actiune: "Delete",
      entitate: "plata",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async beforeUpdate(event) {
    // added_by should not be changed after creation
    const { data } = event.params;
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn("Attempt to modify added_by field blocked");
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
    const factura = await strapi.db.query("api::factura.factura").findOne({
      where: { id: facturaId },
      select: ["id", "total", "status", "documentId"],
    });

    if (!factura || factura.status === "Anulata") {
      return;
    }

    // Get all payments for this invoice
    const payments = await strapi.db.query("api::plata.plata").findMany({
      where: { factura: facturaId },
      select: ["suma"],
    });

    const totalPayments = payments.reduce((sum, payment) => {
      return sum + (parseFloat(String(payment.suma)) || 0);
    }, 0);

    const invoiceTotal = parseFloat(String(factura.total)) || 0;

    let newStatus = factura.status;
    if (totalPayments >= invoiceTotal && invoiceTotal > 0) {
      newStatus = "Platita";
    } else if (totalPayments > 0) {
      newStatus = "Partiala";
    }

    // Only update if status changed
    if (newStatus !== factura.status) {
      await strapi.db.query("api::factura.factura").update({
        where: { id: facturaId },
        data: { status: newStatus },
      });

      strapi.log.info(
        `[PLATA] Invoice ${facturaId} status updated: ${factura.status} -> ${newStatus} (paid ${totalPayments}/${invoiceTotal})`
      );
    }
  } catch (error) {
    strapi.log.error(
      `[PLATA] Error updating invoice status: ${error.message}`
    );
  }
}
