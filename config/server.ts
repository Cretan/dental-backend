export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'), // Bind all IPv4 interfaces (required for Docker; set HOST=127.0.0.1 for local-only)
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
