module.exports = ({ env }) => ({
  jwt: {
    jwtSecret: env('JWT_SECRET') || 'defaultJwtSecret123!@#',
  },
  grant: {
    email: {
      enabled: true,
      icon: 'envelope',
    },
  },
});
