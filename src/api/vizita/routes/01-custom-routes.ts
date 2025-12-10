export default {
  routes: [
    {
      method: 'GET',
      path: '/vizitas/upcoming',
      handler: 'vizita.upcoming',
    },
    {
      method: 'GET',
      path: '/vizitas/history/:patientId',
      handler: 'vizita.history',
    },
  ],
};
