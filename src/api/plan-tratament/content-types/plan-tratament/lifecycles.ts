/**
 * Plan Tratament Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Audit logging for create, update, delete operations
 * Data integrity: archived patient check, delete cascade protection
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
        "Treatment plan created without authenticated user - added_by not set"
      );
    }

    // Auto-populate data_creare if not provided
    if (!data.data_creare) {
      data.data_creare = new Date().toISOString();
    }

    // GAP-6: Block treatment plan creation for archived patients
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
            "Cannot create treatment plan for archived patient. Reactivate the patient first."
          );
        }
      }
    }
  },

  async beforeUpdate(event) {
    // added_by should not be changed after creation
    const { data } = event.params;
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn("Attempt to modify added_by field blocked");
    }
  },

  async beforeDelete(event) {
    const { where } = event.params;
    const knex = strapi.db.connection;

    // GAP-1: Block deletion if treatment plan has linked invoices
    const plans = await strapi.db
      .query("api::plan-tratament.plan-tratament")
      .findMany({
        where,
        select: ["id"],
      });

    if (plans.length === 0) return;

    const planIds = plans.map((p: { id: number }) => p.id);

    const result = await knex("facturas_plan_tratament_lnk")
      .whereIn("plan_tratament_id", planIds)
      .count("plan_tratament_id as count")
      .first();

    const count = Number(result?.count ?? 0);
    if (count > 0) {
      throw new ApplicationError(
        `Cannot delete treatment plan: has ${count} linked invoice(s). Delete the invoices first.`
      );
    }
  },

  async afterCreate(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "plan-tratament",
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
      entitate: "plan-tratament",
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
      entitate: "plan-tratament",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },
};
