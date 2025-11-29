export default {
  routes: [
    {
      method: 'GET',
      path: '/plan-trataments/:id/summary',
      handler: 'plan-tratament.summary',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/calculate-cost',
      handler: 'plan-tratament.calculateCost',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/apply-discount',
      handler: 'plan-tratament.applyDiscount',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/generate-invoice',
      handler: 'plan-tratament.generateInvoice',
      config: {
        auth: false,
      },
    },
  ],
};
