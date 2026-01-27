/**
 * Audit Logger Utility
 * Reusable function for creating audit log entries.
 * Fire-and-forget: errors are logged but never thrown to avoid
 * breaking the main operation flow.
 */

// Strapi's internal transaction context uses AsyncLocalStorage.
// We need to clear it before making deferred Document Service calls.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { transactionCtx } = require("@strapi/database/dist/transaction-context");

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
 * The write is deferred via setImmediate for two reasons:
 *
 * 1. DEADLOCK PREVENTION: Lifecycle hooks run inside the Document
 *    Service's wrapInTransaction (which holds a pool connection).
 *    With SQLite's single-writer constraint, a synchronous audit
 *    write would deadlock trying to acquire the same connection.
 *    setImmediate defers until after the outer transaction commits.
 *
 * 2. STALE CONTEXT CLEANUP: setImmediate inherits the parent's
 *    AsyncLocalStorage context, which still contains the (now
 *    committed) transaction reference from wrapInTransaction.
 *    Without clearing this, strapi.documents().create() would
 *    detect the stale transaction via transactionCtx.get() and
 *    try to reuse it — corrupting the operation. We clear the
 *    context with transactionCtx.run(null, ...) so the Document
 *    Service creates a fresh, independent transaction.
 *
 * @param strapi - The global Strapi instance
 * @param entry - The audit log entry data
 */
export function logAuditEvent(
  strapi: any,
  entry: AuditLogEntry
): void {
  setImmediate(() => {
    // Clear the inherited transaction context so the Document Service
    // creates a fresh transaction instead of reusing the stale one.
    transactionCtx.run(null, async () => {
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
    });
  });
}
