/**
 * pacient router with authentication and policy
 * Secured with session-auth middleware and cabinet-isolation policy
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::pacient.pacient", {
  config: {
    find: {
      policies: ["global::cabinet-isolation"],
    },
    findOne: {
      policies: ["global::cabinet-isolation"],
    },
    create: {
      policies: ["global::cabinet-isolation"],
    },
    update: {
      policies: ["global::cabinet-isolation"],
    },
    delete: {
      policies: ["global::cabinet-isolation"],
    },
  },
});
