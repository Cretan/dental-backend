/**
 * price-list router with policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::price-list.price-list", {
  config: {
    find: {
      middlewares: [],
      policies: [],
    },
    findOne: {
      middlewares: [],
      policies: [],
    },
    create: {
      middlewares: [],
      policies: [],
    },
    update: {
      middlewares: [],
      policies: [],
    },
    delete: {
      middlewares: [],
      policies: [],
    },
  },
});
