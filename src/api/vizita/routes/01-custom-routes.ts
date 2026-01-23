/**
 * Custom routes for visit management
 * Secured with session-auth middleware and cabinet-isolation policy
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/vizitas/upcoming',
      handler: 'vizita.upcoming',
      config: {
        middlewares: ['global::session-auth'],
        policies: ['global::cabinet-isolation'],
      },
    },
    {
      method: 'GET',
      path: '/vizitas/history/:patientId',
      handler: 'vizita.history',
      config: {
        middlewares: ['global::session-auth'],
        policies: ['global::cabinet-isolation'],
      },
    },
  ],
};
