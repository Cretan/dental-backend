/**
 * pacient router with authentication and policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::pacient.pacient", {
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
