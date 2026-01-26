/**
 * Audit Log Controller
 * Read-only controller for audit log entries
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController("api::audit-log.audit-log");
