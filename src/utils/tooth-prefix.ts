/**
 * Tooth Number Prefix Utilities
 *
 * Handles transformation between frontend tooth numbers (e.g., "11")
 * and database format (e.g., "dinte_11").
 * Extracted from plan-tratament controller for testability and reuse.
 */

/**
 * Add "dinte_" prefix to a tooth number.
 * Returns null for falsy input. Returns as-is if already prefixed.
 */
export const addDintePrefix = (numarDinte: string | null | undefined): string | null => {
  if (!numarDinte) return null;
  if (numarDinte.startsWith('dinte_')) return numarDinte;
  return `dinte_${numarDinte}`;
};

/**
 * Remove "dinte_" prefix from a tooth number.
 * Returns null for falsy input. Returns as-is if no prefix.
 */
export const removeDintePrefix = (numarDinte: string | null | undefined): string | null => {
  if (!numarDinte) return null;
  if (numarDinte.startsWith('dinte_')) {
    return numarDinte.substring(6);
  }
  return numarDinte;
};

/**
 * Transform tratamente array: add prefix to numar_dinte for DB storage.
 */
export const transformTratamenteForDB = (tratamente: any[]): any[] => {
  return tratamente.map((t) => ({
    ...t,
    numar_dinte: addDintePrefix(t.numar_dinte),
  }));
};

/**
 * Transform tratamente array: remove prefix from numar_dinte for frontend.
 */
export const transformTratamenteForFrontend = (tratamente: any[]): any[] => {
  if (!tratamente) return [];
  return tratamente.map((t) => ({
    ...t,
    numar_dinte: removeDintePrefix(t.numar_dinte),
  }));
};
