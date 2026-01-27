/**
 * cabinet controller
 */

import { factories } from '@strapi/strapi';
import { sanitizeTextFields } from '../../../utils/validators';

const CABINET_TEXT_FIELDS = ['nume_cabinet', 'adresa', 'telefon', 'email'];

export default factories.createCoreController('api::cabinet.cabinet', {
  async create(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, CABINET_TEXT_FIELDS);
    }
    return super.create(ctx);
  },
  async update(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, CABINET_TEXT_FIELDS);
    }
    return super.update(ctx);
  },
});
