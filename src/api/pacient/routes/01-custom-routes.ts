/**
 * Custom routes for patient search and statistics
 */

export default {
  routes: [
    // Search endpoint
    {
      method: 'GET',
      path: '/pacients/search',
      handler: 'pacient.search',
    },
    // Statistics endpoint
    {
      method: 'GET',
      path: '/pacients/statistics',
      handler: 'pacient.statistics',
    },
  ],
};
