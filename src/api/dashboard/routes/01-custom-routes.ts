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
        policies: [
          'global::cabinet-isolation',
          {
            name: 'global::role-check',
            config: {
              roles: [
                'super_admin',
                'cabinet_admin',
                'dentist',
                'receptionist',
                'accountant',
              ],
            },
          },
        ],
        middlewares: [
          {
            name: 'global::rate-limit',
            config: { maxRequests: 10, windowMs: 60000 },
          },
        ],
      },
    },
  ],
};
