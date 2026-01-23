/**
 * vizita router with authentication and policy
 * Secured with session-auth middleware and cabinet-isolation policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::vizita.vizita", {
  config: {
    find: {
      middlewares: ["global::session-auth"],
      policies: ["global::cabinet-isolation"],
    },
    findOne: {
      middlewares: ["global::session-auth"],
      policies: ["global::cabinet-isolation"],
    },
    create: {
      middlewares: ["global::session-auth"],
      policies: ["global::cabinet-isolation"],
    },
    update: {
      middlewares: ["global::session-auth"],
      policies: ["global::cabinet-isolation"],
    },
    delete: {
      middlewares: ["global::session-auth"],
      policies: ["global::cabinet-isolation"],
    },
  },
});
