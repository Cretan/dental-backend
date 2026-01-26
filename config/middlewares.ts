export default [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": ["'self'", "data:", "blob:"],
          "media-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        process.env.FRONTEND_URL,
      ].filter(Boolean),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      keepHeaderOnError: true,
    },
  },
  {
    name: "strapi::poweredBy",
    config: {
      poweredBy: "Healthcare API",
    },
  },
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "global::session-auth",
  "strapi::favicon",
  "strapi::public",
];
