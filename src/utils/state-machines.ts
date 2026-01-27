/**
 * State Machine Definitions
 *
 * Defines valid status transitions for visits and invoices.
 * Used by lifecycle hooks to enforce forward-only status progression.
 */

/**
 * Valid visit status transitions.
 * Programata → Confirmata | Anulata
 * Confirmata → Finalizata | Anulata
 * Finalizata → (terminal)
 * Anulata → Programata (reschedule)
 */
export const VISIT_STATUS_TRANSITIONS: Record<string, string[]> = {
  Programata: ["Confirmata", "Anulata"],
  Confirmata: ["Finalizata", "Anulata"],
  Finalizata: [],
  Anulata: ["Programata"],
};

/**
 * Valid invoice status transitions.
 * Draft → Emisa | Anulata
 * Emisa → Partiala | Platita | Anulata
 * Partiala → Platita | Anulata
 * Platita → (terminal)
 * Anulata → (terminal)
 */
export const INVOICE_STATUS_TRANSITIONS: Record<string, string[]> = {
  Draft: ["Emisa", "Anulata"],
  Emisa: ["Partiala", "Platita", "Anulata"],
  Partiala: ["Platita", "Anulata"],
  Platita: [],
  Anulata: [],
};

/**
 * Check if a status transition is valid according to the given state machine.
 * Returns true if the transition is allowed, false otherwise.
 */
export function isValidTransition(
  transitions: Record<string, string[]>,
  currentStatus: string,
  newStatus: string
): boolean {
  if (currentStatus === newStatus) return true;
  const allowed = transitions[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Get the list of statuses reachable from the current status.
 * Returns an empty array for terminal states or unknown statuses.
 */
export function getAvailableTransitions(
  transitions: Record<string, string[]>,
  currentStatus: string
): string[] {
  return transitions[currentStatus] || [];
}
