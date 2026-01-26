/**
 * Audit Logger Utility
 * Reusable function for creating audit log entries.
 * Fire-and-forget: errors are logged but never thrown to avoid
 * breaking the main operation flow.
 */

interface AuditLogEntry {
  actiune: "Create" | "Update" | "Delete" | "View";
  entitate: string;
  entitate_id: string;
  date_vechi?: object | null;
  date_noi?: object | null;
  ip_address?: string;
  user?: number;
  cabinet?: number;
  detalii?: string;
}

/**
 * Create an audit log entry in the database.
 * This function is designed to be non-blocking and safe:
 * it will never throw errors that could break the caller's flow.
 *
 * @param strapi - The global Strapi instance
 * @param entry - The audit log entry data
 */
export async function logAuditEvent(
  strapi: any,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await strapi.documents("api::audit-log.audit-log").create({
      data: {
        actiune: entry.actiune,
        entitate: entry.entitate,
        entitate_id: entry.entitate_id,
        date_vechi: entry.date_vechi || null,
        date_noi: entry.date_noi || null,
        ip_address: entry.ip_address || null,
        user: entry.user || null,
        cabinet: entry.cabinet || null,
        detalii: entry.detalii || null,
      },
    });
  } catch (error: any) {
    // Log error but never throw - audit logging must not break the main flow
    strapi.log.error(
      `[AUDIT] Audit log creation failed for ${entry.actiune} on ${entry.entitate}: ${error.message}`
    );
  }
}
