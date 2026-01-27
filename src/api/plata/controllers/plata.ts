/**
 * plata controller
 */

import { factories } from "@strapi/strapi";
import { sanitizeTextFields } from "../../../utils/validators";

const PLATA_TEXT_FIELDS = ["observatii", "referinta"];

export default factories.createCoreController("api::plata.plata", {
  async create(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, PLATA_TEXT_FIELDS);
    }
    return super.create(ctx);
  },
  async update(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, PLATA_TEXT_FIELDS);
    }
    return super.update(ctx);
  },
});
