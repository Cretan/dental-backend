// Build CORS origins array based on environment
const corsOrigins: string[] = [];

// Parse CORS_ORIGINS (comma-separated list for production deployments)
if (process.env.CORS_ORIGINS) {
  corsOrigins.push(
    ...process.env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  );
}

// FRONTEND_URL as single-origin fallback (backward compatible)
if (process.env.FRONTEND_URL) {
  const frontendUrl = process.env.FRONTEND_URL.trim().replace(/\/+$/, "");
  if (frontendUrl && !corsOrigins.includes(frontendUrl)) {
    corsOrigins.push(frontendUrl);
  }
}

// Development origins (non-production only)
if (process.env.NODE_ENV !== "production") {
  const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  devOrigins.forEach((origin) => {
    if (!corsOrigins.includes(origin)) {
      corsOrigins.push(origin);
    }
  });
}

// SECURITY: Fail closed - require explicit CORS origins in production
if (process.env.NODE_ENV === "production" && corsOrigins.length === 0) {
  throw new Error(
    "CORS_ORIGINS or FRONTEND_URL must be set in production. " +
    "Example: CORS_ORIGINS=https://app.example.com"
  );
}

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
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
      frameguard: {
        action: "deny",
      },
      xContentTypeOptions: true,
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      headers: ["Content-Type", "Authorization", "Origin", "Accept"],
      keepHeaderOnError: true,
      credentials: true,
      maxAge: 86400,
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
