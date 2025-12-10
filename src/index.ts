import type { Core } from '@strapi/strapi';
const bcrypt = require('bcryptjs');

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
    // Create test user if it doesn't exist
    const testEmail = 'test@test.com';
    const testPassword = 'Test123!@#';
    
    strapi.log.info('🔍 Checking for test user...');
    
    const existingUser = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: testEmail },
    });

    // Delete existing user and recreate (to ensure password is correct)
    if (existingUser) {
      strapi.log.info(`Deleting existing test user (ID: ${existingUser.id})...`);
      await strapi.query('plugin::users-permissions.user').delete({
        where: { id: existingUser.id },
      });
    }
    
    strapi.log.info('Creating test user...');
    
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (!authenticatedRole) {
      strapi.log.error('❌ Authenticated role not found!');
      return;
    }

    // Use bcrypt to hash password properly
    try {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      strapi.log.info(`Password hashed (length: ${hashedPassword.length})`);
      
      const newUser = await strapi.query('plugin::users-permissions.user').create({
        data: {
          username: 'testuser',
          email: testEmail,
          password: hashedPassword,
          confirmed: true,
          blocked: false,
          provider: 'local',
          role: authenticatedRole.id,
        },
      });
      
      strapi.log.info(`✅ Test user created: ${testEmail} (ID: ${newUser.id})`);
    } catch (error) {
      strapi.log.error(`❌ Failed to create test user: ${error.message}`);
    }
    
    // Set permissions for AUTHENTICATED role (used by tests with JWT)
    if (authenticatedRole) {
      const actions = [
        // Pacient permissions
        'api::pacient.pacient.find',
        'api::pacient.pacient.findOne',
        'api::pacient.pacient.create',
        'api::pacient.pacient.update',
        'api::pacient.pacient.delete',
        'api::pacient.pacient.search',
        'api::pacient.pacient.statistics',
        // Plan Tratament permissions
        'api::plan-tratament.plan-tratament.find',
        'api::plan-tratament.plan-tratament.findOne',
        'api::plan-tratament.plan-tratament.create',
        'api::plan-tratament.plan-tratament.update',
        'api::plan-tratament.plan-tratament.delete',
        'api::plan-tratament.plan-tratament.summary',
        'api::plan-tratament.plan-tratament.calculateCost',
        'api::plan-tratament.plan-tratament.applyDiscount',
        'api::plan-tratament.plan-tratament.generateInvoice',
        // Vizita permissions
        'api::vizita.vizita.find',
        'api::vizita.vizita.findOne',
        'api::vizita.vizita.create',
        'api::vizita.vizita.update',
        'api::vizita.vizita.delete',
        'api::vizita.vizita.upcoming',
        'api::vizita.vizita.history',
        // Cabinet permissions
        'api::cabinet.cabinet.find',
        'api::cabinet.cabinet.findOne',
        'api::cabinet.cabinet.create',
        'api::cabinet.cabinet.update',
        'api::cabinet.cabinet.delete',
        // Price List permissions
        'api::price-list.price-list.find',
        'api::price-list.price-list.findOne',
        'api::price-list.price-list.create',
        'api::price-list.price-list.update',
        'api::price-list.price-list.delete',
      ];

      for (const action of actions) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: { 
            role: authenticatedRole.id,
            action: action
          },
        });

        if (existing) {
          await strapi.query('plugin::users-permissions.permission').update({
            where: { id: existing.id },
            data: { enabled: true },
          });
        } else {
          // Create permission if it doesn't exist
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: action,
              role: authenticatedRole.id,
              enabled: true,
            },
          });
        }
      }
      
      strapi.log.info('✅ Authenticated role permissions set');
    }
    
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
        'api::pacient.pacient.search',
        'api::pacient.pacient.statistics',
        // Plan Tratament permissions
        'api::plan-tratament.plan-tratament.find',
        'api::plan-tratament.plan-tratament.findOne',
        'api::plan-tratament.plan-tratament.create',
        'api::plan-tratament.plan-tratament.update',
        'api::plan-tratament.plan-tratament.delete',
        'api::plan-tratament.plan-tratament.summary',
        'api::plan-tratament.plan-tratament.calculateCost',
        'api::plan-tratament.plan-tratament.applyDiscount',
        'api::plan-tratament.plan-tratament.generateInvoice',
        // Vizita permissions
        'api::vizita.vizita.find',
        'api::vizita.vizita.findOne',
        'api::vizita.vizita.create',
        'api::vizita.vizita.update',
        'api::vizita.vizita.delete',
        'api::vizita.vizita.upcoming',
        'api::vizita.vizita.history',
        // Cabinet permissions
        'api::cabinet.cabinet.find',
        'api::cabinet.cabinet.findOne',
        'api::cabinet.cabinet.create',
        'api::cabinet.cabinet.update',
        'api::cabinet.cabinet.delete',
        // Price List permissions
        'api::price-list.price-list.find',
        'api::price-list.price-list.findOne',
        'api::price-list.price-list.create',
        'api::price-list.price-list.update',
        'api::price-list.price-list.delete',
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
        } else {
          // Create permission if it doesn't exist
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: action,
              role: publicRole.id,
              enabled: true,
            },
          });
        }
      }
      
      strapi.log.info('✅ Public role permissions set');
    }
  },
};
