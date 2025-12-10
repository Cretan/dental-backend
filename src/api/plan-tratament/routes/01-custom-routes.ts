export default {
  routes: [
    // Custom endpoints
    {
      method: 'GET',
      path: '/plan-trataments/:id/summary',
      handler: 'plan-tratament.summary',
    },
    {
      method: 'POST',
      path: '/plan-trataments/calculate-cost',
      handler: 'plan-tratament.calculateCost',
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/apply-discount',
      handler: 'plan-tratament.applyDiscount',
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/generate-invoice',
      handler: 'plan-tratament.generateInvoice',
    },
  ],
};
