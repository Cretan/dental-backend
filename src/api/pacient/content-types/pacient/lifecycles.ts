/**
 * Pacient Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Audit logging for create, update, delete operations
 * Delete protection: prevents deletion when related records exist
 * Production-ready implementation using JWT token from request context
 */

import { errors } from "@strapi/utils";
import { logAuditEvent } from "../../../../utils/audit-logger";

const { ApplicationError } = errors;

/**
 * Related entity link tables to check before allowing patient deletion.
 * Each entry maps a Strapi v5 link table to its patient FK column and a
 * human-readable label (Romanian + English) for the error message.
 */
const PATIENT_RELATIONS = [
  { table: "vizitas_pacient_lnk", column: "pacient_id", label: "vizite (visits)" },
  { table: "plan_trataments_pacient_lnk", column: "pacient_id", label: "planuri de tratament (treatment plans)" },
  { table: "facturas_pacient_lnk", column: "pacient_id", label: "facturi (invoices)" },
  { table: "platas_pacient_lnk", column: "pacient_id", label: "plăți (payments)" },
];

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      // In production, this should never happen if authentication is enforced
      strapi.log.warn(
        "Patient created without authenticated user - added_by not set"
      );
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

  async afterCreate(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "pacient",
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
      entitate: "pacient",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: null,
      date_noi: params.data,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },

  async beforeDelete(event) {
    const { where } = event.params;
    const knex = strapi.db.connection;

    // Resolve database IDs for the patient(s) being deleted
    const patients = await strapi.db.query("api::pacient.pacient").findMany({
      where,
      select: ["id"],
    });

    if (patients.length === 0) return;

    const patientIds = patients.map((p: { id: number }) => p.id);

    // Check all related entities via their link tables
    const related: string[] = [];
    for (const { table, column, label } of PATIENT_RELATIONS) {
      const result = await knex(table)
        .whereIn(column, patientIds)
        .count(`${column} as count`)
        .first();
      const count = Number(result?.count ?? 0);
      if (count > 0) {
        related.push(`${count} ${label}`);
      }
    }

    if (related.length > 0) {
      throw new ApplicationError(
        `Cannot delete patient: has ${related.join(", ")}. Archive the patient instead.`
      );
    }
  },

  async afterDelete(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Delete",
      entitate: "pacient",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },
};
