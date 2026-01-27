/**
 * Custom routes for visit management
 * Secured with session-auth middleware, cabinet-isolation, and role-check policies
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/vizitas/upcoming',
      handler: 'vizita.upcoming',
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
              ],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/vizitas/history/:patientId',
      handler: 'vizita.history',
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
              ],
            },
          },
        ],
      },
    },
  ],
};
