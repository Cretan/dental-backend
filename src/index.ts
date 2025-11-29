import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Set public permissions for API endpoints (for testing)
    const publicRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });

    if (publicRole) {
      const actions = [
        // Pacient permissions
        'api::pacient.pacient.find',
        'api::pacient.pacient.findOne',
        'api::pacient.pacient.create',
        'api::pacient.pacient.update',
        'api::pacient.pacient.delete',
        // Plan Tratament permissions
        'api::plan-tratament.plan-tratament.find',
        'api::plan-tratament.plan-tratament.findOne',
        'api::plan-tratament.plan-tratament.create',
        'api::plan-tratament.plan-tratament.update',
        'api::plan-tratament.plan-tratament.delete',
        // Vizita permissions
        'api::vizita.vizita.find',
        'api::vizita.vizita.findOne',
        'api::vizita.vizita.create',
        'api::vizita.vizita.update',
        'api::vizita.vizita.delete',
        // Cabinet permissions
        'api::cabinet.cabinet.find',
        'api::cabinet.cabinet.findOne',
        'api::cabinet.cabinet.create',
        'api::cabinet.cabinet.update',
        'api::cabinet.cabinet.delete',
      ];

      for (const action of actions) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: { 
            role: publicRole.id,
            action: action
          },
        });

        if (existing) {
          await strapi.query('plugin::users-permissions.permission').update({
            where: { id: existing.id },
            data: { enabled: true },
          });
        }
      }
    }
  },
};
