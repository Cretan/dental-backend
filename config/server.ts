export default ({ env }) => ({
  host: env('HOST', '127.0.0.1'), // Use IPv4 explicitly to avoid IPv6 issues
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
});
