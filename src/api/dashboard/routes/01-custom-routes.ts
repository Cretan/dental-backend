/**
 * Dashboard custom routes
 * Provides aggregated stats endpoint for the dashboard page
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/dashboard/stats',
      handler: 'dashboard.stats',
      config: {
        policies: [],
      },
    },
  ],
};
