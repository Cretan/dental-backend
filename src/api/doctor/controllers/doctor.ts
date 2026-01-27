/**
 * doctor controller
 */

import { factories } from "@strapi/strapi";
import { sanitizeTextFields } from "../../../utils/validators";

const DOCTOR_TEXT_FIELDS = ["nume", "prenume", "nr_licenta", "telefon"];

export default factories.createCoreController("api::doctor.doctor", {
  async create(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, DOCTOR_TEXT_FIELDS);
    }
    return super.create(ctx);
  },
  async update(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, DOCTOR_TEXT_FIELDS);
    }
    return super.update(ctx);
  },
});
