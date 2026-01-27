export default {
  routes: [
    // Custom endpoints
    {
      method: 'GET',
      path: '/plan-trataments/:id/summary',
      handler: 'plan-tratament.summary',
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
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/calculate-cost',
      handler: 'plan-tratament.calculateCost',
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
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/apply-discount',
      handler: 'plan-tratament.applyDiscount',
      config: {
        policies: [
          'global::cabinet-isolation',
          {
            name: 'global::role-check',
            config: {
              roles: ['super_admin', 'clinic_admin', 'cabinet_admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/plan-trataments/:id/generate-invoice',
      handler: 'plan-tratament.generateInvoice',
      config: {
        policies: [
          'global::cabinet-isolation',
          {
            name: 'global::role-check',
            config: {
              roles: ['super_admin', 'clinic_admin', 'cabinet_admin', 'accountant'],
            },
          },
        ],
      },
    },
  ],
};
