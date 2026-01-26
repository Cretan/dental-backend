export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/refresh',
      handler: 'auth-custom.refresh',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
