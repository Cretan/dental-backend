/**
 * Price List Lifecycle Hooks
 * Audit logging for create, update, delete operations
 * Production-ready implementation
 */

import { logAuditEvent } from "../../../../utils/audit-logger";

export default {
  async afterCreate(event) {
    const ctx = strapi.requestContext?.get();
    const { result } = event;
    await logAuditEvent(strapi, {
      actiune: "Create",
      entitate: "price-list",
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
      entitate: "price-list",
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
      entitate: "price-list",
      entitate_id: result?.documentId || String(result?.id || ""),
      date_vechi: result,
      date_noi: null,
      ip_address: ctx?.request?.ip,
      user: ctx?.state?.user?.id,
      cabinet: ctx?.state?.primaryCabinetId,
    });
  },
};
