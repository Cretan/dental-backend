/**
 * Cabinet Content-Type Registry
 *
 * Centralized list of all content types that have a `cabinet` relation
 * and require cabinet-based filtering in session-auth middleware.
 *
 * When adding a new content type with cabinet isolation:
 * 1. Add it to the CABINET_CONTENT_TYPES array below
 * 2. The bootstrap validator will warn if you forget
 *
 * The bootstrap-time validation (see src/index.ts) cross-checks this
 * registry against actual Strapi content-type schemas to detect:
 * - Content types with a `cabinet` attribute NOT listed here (security gap)
 * - Registry entries whose content type has no `cabinet` attribute (stale entry)
 */

export interface CabinetContentType {
  /** Strapi API name (singularName), e.g. 'pacient' */
  apiName: string;
  /** URL plural name used in /api/{pluralName}, e.g. 'pacients' */
  pluralName: string;
}

export const CABINET_CONTENT_TYPES: CabinetContentType[] = [
  { apiName: 'pacient',        pluralName: 'pacients' },
  { apiName: 'vizita',         pluralName: 'vizitas' },
  { apiName: 'plan-tratament', pluralName: 'plan-trataments' },
  { apiName: 'price-list',     pluralName: 'price-lists' },
  { apiName: 'doctor',         pluralName: 'doctors' },
  { apiName: 'factura',        pluralName: 'facturas' },
  { apiName: 'plata',          pluralName: 'platas' },
  { apiName: 'audit-log',      pluralName: 'audit-logs' },
  { apiName: 'radiografie',    pluralName: 'radiografii' },
];

/**
 * Set of URL fragments for cabinet-filterable content types.
 * Used by session-auth middleware for data-driven cabinet filtering.
 * E.g. '/pacients', '/vizitas', '/radiografii'
 */
export const CABINET_FILTERABLE_URLS = new Set(
  CABINET_CONTENT_TYPES.map((ct) => `/${ct.pluralName}`)
);
