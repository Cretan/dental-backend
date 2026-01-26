/**
 * Audit Log Service
 * Read-only service for audit log entries
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreService("api::audit-log.audit-log");
