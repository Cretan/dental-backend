export default ({ env }) => ({
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '2h',
      },
      ratelimit: {
        enabled: true,
        interval: { min: 1 },
        max: env('NODE_ENV') === 'development' ? 100 : 10,
      },
    },
  },
  upload: {
    config: {
      sizeLimit: 5 * 1024 * 1024, // 5 MB max file size
    },
  },
});
