/**
 * Factura Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Auto-generates numar_factura per cabinet (incremental, retry on collision)
 * Audit logging for create, update, delete operations
 * Data integrity: date validation, status state machine, delete cascade protection
 */

import { errors } from "@strapi/utils";
import { logAuditEvent } from "../../../../utils/audit-logger";
import { validateDateOrder } from "../../../../utils/validators";
import {
  INVOICE_STATUS_TRANSITIONS,
  isValidTransition,
} from "../../../../utils/state-machines";

const { ApplicationError } = errors;

const MAX_INVOICE_NUMBER_RETRIES = 3;

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      strapi.log.warn(
        "Invoice created without authenticated user - added_by not set"
      );
    }

    // Auto-populate data_emitere if not provided
    if (!data.data_emitere) {
      data.data_emitere = new Date().toISOString().split("T")[0];
    }

    // Auto-set status to Draft if not provided
    if (!data.status) {
      data.status = "Draft";
    }

    // GAP-2: Validate due date >= issue date
    const dateError = validateDateOrder(
      data.data_emitere,
      data.data_scadenta,
      "data emitere (issue date)",
      "data scadență (due date)"
    );
    if (dateError) {
      throw new ApplicationError(dateError);
    }

    // GAP-3: Auto-generate numar_factura with retry loop for race conditions
    if (!data.numar_factura && data.cabinet) {
      const cabinetId =
        typeof data.cabinet === "object" ? data.cabinet.id : data.cabinet;

      let generated = false;
      for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_RETRIES; attempt++) {
        try {
          const existingInvoices = await strapi.db
            .query("api::factura.factura")
            .findMany({
              where: { cabinet: cabinetId },
              orderBy: { createdAt: "desc" },
              limit: 1,
              select: ["numar_factura"],
            });

          let nextNumber = 1;
          if (
            existingInvoices.length > 0 &&
            existingInvoices[0].numar_factura
          ) {
            const match = existingInvoices[0].numar_factura.match(/(\d+)$/);
            if (match) {
              nextNumber = parseInt(match[1], 10) + 1 + attempt;
            }
          } else {
            nextNumber = 1 + attempt;
          }

          const candidate = `F-${String(nextNumber).padStart(4, "0")}`;

          // Check uniqueness before assigning
          const existing = await strapi.db
            .query("api::factura.factura")
            .findOne({
              where: { numar_factura: candidate, cabinet: cabinetId },
              select: ["id"],
            });

          if (!existing) {
            data.numar_factura = candidate;
            generated = true;
            strapi.log.info(
              `[FACTURA] Auto-generated invoice number: ${candidate} for cabinet ${cabinetId}`
            );
            break;
          }

          strapi.log.warn(
            `[FACTURA] Invoice number collision: ${candidate}, retrying (attempt ${attempt + 1})`
          );
        } catch (error) {
          strapi.log.error(
            `[FACTURA] Error generating invoice number (attempt ${attempt + 1}): ${error.message}`
          );
        }
      }

      if (!generated) {
        // Fallback: timestamp-based number to guarantee uniqueness
        data.numar_factura = `F-${Date.now()}`;
        strapi.log.warn(
          `[FACTURA] Used fallback invoice number: ${data.numar_factura}`
        );
      }
    }
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // added_by should not be changed after creation
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn("Attempt to modify added_by field blocked");
    }

    // GAP-2: Validate due date >= issue date
    if (data.data_emitere || data.data_scadenta) {
      let emitere = data.data_emitere;
      let scadenta = data.data_scadenta;

      // Fetch current record for missing field
      if (!emitere || !scadenta) {
        const current = await strapi.db
          .query("api::factura.factura")
          .findOne({
            where,
            select: ["data_emitere", "data_scadenta", "status"],
          });
        if (current) {
          emitere = emitere || current.data_emitere;
          scadenta = scadenta || current.data_scadenta;
        }
      }

      const dateError = validateDateOrder(
        emitere,
        scadenta,
        "data emitere (issue date)",
        "data scadență (due date)"
      );
      if (dateError) {
        throw new ApplicationError(dateError);
      }
    }

    // GAP-4: Enforce invoice status state machine
    if (data.status) {
      const current = await strapi.db
        .query("api::factura.factura")
        .findOne({
          where,
          select: ["status"],
        });

      if (current && current.status) {
        if (!isValidTransition(INVOICE_STATUS_TRANSITIONS, current.status, data.status)) {
          throw new ApplicationError(
            `Invalid invoice status transition: ${current.status} → ${data.status}`
          );
        }
      }
    }
  },

  async beforeDelete(event) {
    const { where } = event.params;
    const knex = strapi.db.connection;

    // GAP-1: Block deletion if invoice has linked payments
    const invoices = await strapi.db
      .query("api::factura.factura")
      .findMany({
        where,
        select: ["id"],
      });

    if (invoices.length === 0) return;

    const invoiceIds = invoices.map((f: { id: number }) => f.id);

    const result = await knex("platas_factura_lnk")
      .whereIn("factura_id", invoiceIds)
      .count("factura_id as count")
      .first();

    const count = Number(result?.count ?? 0);
    if (count > 0) {
      throw new ApplicationError(
        `Cannot delete invoice: has ${count} linked payment(s). Cancel the invoice instead.`
      );
    }
  },

  async afterCreate(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "factura",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: null,
      date_noi: result,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async afterUpdate(event) {
    const ctx = strapi.requestContext?.get();
    const { result, params } = event;
    await logAuditEvent(strapi, {
      actiune: "Update",
      entitate: "factura",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: null,
      date_noi: params.data,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async afterDelete(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Delete",
      entitate: "factura",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },
};
