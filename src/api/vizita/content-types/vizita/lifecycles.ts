/**
 * Vizita Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Audit logging for create, update, delete operations
 * Data integrity: archived patient check, doctor-cabinet match,
 *   status state machine, finalized date lock
 */

import { errors } from "@strapi/utils";
import { logAuditEvent } from "../../../../utils/audit-logger";
import {
  VISIT_STATUS_TRANSITIONS,
  isValidTransition,
} from "../../../../utils/state-machines";

const { ApplicationError } = errors;

/**
 * Check that the patient is not archived. Throws ApplicationError if archived.
 */
async function checkPatientNotArchived(patientRef: any): Promise<void> {
  if (!patientRef) return;
  const patientId =
    typeof patientRef === "object" ? patientRef.id : patientRef;
  if (!patientId) return;

  const patient = await strapi.db.query("api::pacient.pacient").findOne({
    where: { id: patientId },
    select: ["status_pacient"],
  });

  if (patient && patient.status_pacient === "Arhivat") {
    throw new ApplicationError(
      "Cannot create visit for archived patient. Reactivate the patient first."
    );
  }
}

/**
 * Check that the doctor belongs to the same cabinet as the visit.
 */
async function checkDoctorCabinetMatch(
  doctorRef: any,
  cabinetRef: any
): Promise<void> {
  if (!doctorRef || !cabinetRef) return;

  const doctorId =
    typeof doctorRef === "object" ? doctorRef.id : doctorRef;
  const cabinetId =
    typeof cabinetRef === "object" ? cabinetRef.id : cabinetRef;
  if (!doctorId || !cabinetId) return;

  const knex = strapi.db.connection;
  const link = await knex("doctors_cabinet_lnk")
    .where({ doctor_id: doctorId, cabinet_id: cabinetId })
    .first();

  if (!link) {
    throw new ApplicationError(
      "Doctor does not belong to this cabinet. Assign a doctor from the same clinic."
    );
  }
}

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      strapi.log.warn(
        "Visit created without authenticated user - added_by not set"
      );
    }

    // Auto-populate status_vizita if not provided
    if (!data.status_vizita) {
      data.status_vizita = "Programata";
    }

    // GAP-6: Block visit creation for archived patients
    await checkPatientNotArchived(data.pacient);

    // GAP-7: Validate doctor belongs to same cabinet
    await checkDoctorCabinetMatch(data.medic, data.cabinet);
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // added_by should not be changed after creation
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn("Attempt to modify added_by field blocked");
    }

    // Fetch current record once for all checks
    const current = await strapi.db.query("api::vizita.vizita").findOne({
      where,
      select: ["id", "status_vizita", "data_programare", "cabinet", "medic"],
    });

    if (!current) return;

    // GAP-4: Enforce visit status state machine
    if (data.status_vizita && current.status_vizita) {
      if (
        !isValidTransition(
          VISIT_STATUS_TRANSITIONS,
          current.status_vizita,
          data.status_vizita
        )
      ) {
        throw new ApplicationError(
          `Invalid visit status transition: ${current.status_vizita} → ${data.status_vizita}`
        );
      }
    }

    // GAP-8: Block date change on finalized visits
    if (
      data.data_programare &&
      current.status_vizita === "Finalizata" &&
      data.data_programare !== current.data_programare
    ) {
      throw new ApplicationError(
        "Cannot change appointment date on a finalized visit."
      );
    }

    // GAP-7: Validate doctor-cabinet match if doctor changed
    if (data.medic) {
      const cabinetRef = data.cabinet || current.cabinet;
      await checkDoctorCabinetMatch(data.medic, cabinetRef);
    }
  },

  async afterCreate(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "vizita",
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
      entitate: "vizita",
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
      entitate: "vizita",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },
};
