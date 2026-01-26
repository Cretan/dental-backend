export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/refresh',
      handler: 'auth-custom.refresh',
      config: {
        policies: [],
        middlewares: [
          {
            name: 'global::rate-limit',
            config: { maxRequests: 5, windowMs: 60000 },
          },
        ],
      },
    },
  ],
};
