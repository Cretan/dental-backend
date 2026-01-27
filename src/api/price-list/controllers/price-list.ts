/**
 * price-list controller
 */

import { factories } from '@strapi/strapi';
import { sanitizeTextFields } from '../../../utils/validators';

const PRICE_LIST_TEXT_FIELDS = ['descriere'];

export default factories.createCoreController('api::price-list.price-list', {
  async create(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, PRICE_LIST_TEXT_FIELDS);
    }
    return super.create(ctx);
  },
  async update(ctx) {
    const data = ctx.request.body?.data;
    if (data) {
      sanitizeTextFields(data, PRICE_LIST_TEXT_FIELDS);
    }
    return super.update(ctx);
  },
});
