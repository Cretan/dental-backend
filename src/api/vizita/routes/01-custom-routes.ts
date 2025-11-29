export default {
  routes: [
    {
      method: 'GET',
      path: '/vizitas/upcoming',
      handler: 'vizita.upcoming',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/vizitas/history/:patientId',
      handler: 'vizita.history',
      config: {
        auth: false,
      },
    },
  ],
};
