/**
 * cabinet router with authentication and policy
 */
import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::cabinet.cabinet", {
  config: {
    find: {
      middlewares: ["global::session-auth"],
    },
    findOne: {
      middlewares: ["global::session-auth"],
    },
    create: {
      middlewares: ["global::session-auth"],
    },
    update: {
      middlewares: ["global::session-auth"],
    },
    delete: {
      middlewares: ["global::session-auth"],
    },
  },
});
