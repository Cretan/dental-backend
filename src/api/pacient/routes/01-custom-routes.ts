/**
 * Custom routes for patient search and statistics
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/pacients/search',
      handler: 'pacient.search',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/pacients/statistics',
      handler: 'pacient.statistics',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
