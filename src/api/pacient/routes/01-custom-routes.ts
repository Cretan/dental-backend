/**
 * Custom routes for patient search and statistics
 * Secured with session-auth middleware, cabinet-isolation, and role-check policies
 */

export default {
  routes: [
    // Search endpoint
    {
      method: 'GET',
      path: '/pacients/search',
      handler: 'pacient.search',
      config: {
        policies: [
          'global::cabinet-isolation',
          {
            name: 'global::role-check',
            config: {
              roles: [
                'super_admin',
                'clinic_admin',
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
            config: { maxRequests: 30, windowMs: 60000 },
          },
        ],
      },
    },
    // Statistics endpoint
    {
      method: 'GET',
      path: '/pacients/statistics',
      handler: 'pacient.statistics',
      config: {
        policies: [
          'global::cabinet-isolation',
          {
            name: 'global::role-check',
            config: {
              roles: ['super_admin', 'clinic_admin', 'cabinet_admin', 'dentist'],
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
