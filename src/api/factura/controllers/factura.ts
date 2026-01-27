/**
 * factura controller
 */

import { factories } from "@strapi/strapi";
import { sanitizeTextFields } from "../../../utils/validators";

const FACTURA_TEXT_FIELDS = ["observatii", "numar_factura"];

export default factories.createCoreController("api::factura.factura", {
  async create(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, FACTURA_TEXT_FIELDS);
    }
    return super.create(ctx);
  },
  async update(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, FACTURA_TEXT_FIELDS);
    }
    return super.update(ctx);
  },
});
