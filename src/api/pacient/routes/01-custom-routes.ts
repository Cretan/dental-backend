/**
 * Custom routes for patient search and statistics
 * Secured with session-auth middleware and cabinet-isolation policy
 */

export default {
  routes: [
    // Search endpoint
    {
      method: 'GET',
      path: '/pacients/search',
      handler: 'pacient.search',
      config: {
        policies: ['global::cabinet-isolation'],
      },
    },
    // Statistics endpoint
    {
      method: 'GET',
      path: '/pacients/statistics',
      handler: 'pacient.statistics',
      config: {
        policies: ['global::cabinet-isolation'],
      },
    },
  ],
};
