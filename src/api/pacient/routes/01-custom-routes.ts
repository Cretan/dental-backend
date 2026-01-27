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
                'cabinet_admin',
                'dentist',
                'receptionist',
                'accountant',
              ],
            },
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
              roles: ['super_admin', 'cabinet_admin', 'dentist'],
            },
          },
        ],
      },
    },
  ],
};
