/**
 * Reset test user - deletes and recreates test@test.com
 */
const { createStrapi } = require('@strapi/strapi');

async function resetTestUser() {
  const strapi = await createStrapi();
  await strapi.load();
  
  try {
    const testEmail = 'test@test.com';
    const testPassword = 'Test123!@#';
    
    // Delete existing test user
    const existingUser = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: testEmail },
    });
    
    if (existingUser) {
      console.log(`Deleting existing test user (ID: ${existingUser.id})...`);
      await strapi.query('plugin::users-permissions.user').delete({
        where: { id: existingUser.id },
      });
      console.log('✅ Old test user deleted');
    } else {
      console.log('No existing test user found');
    }
    
    // Get authenticated role
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });
    
    if (!authenticatedRole) {
      console.error('❌ Authenticated role not found!');
      process.exit(1);
    }
    
    // Create new test user using Strapi service
    console.log('Creating new test user...');
    const newUser = await strapi.plugin('users-permissions').service('user').add({
      username: 'testuser',
      email: testEmail,
      password: testPassword,
      confirmed: true,
      blocked: false,
      role: authenticatedRole.id,
    });
    
    console.log(`✅ Test user created: ${testEmail} (ID: ${newUser.id})`);
    console.log(`Password: ${testPassword}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await strapi.destroy();
  }
}

resetTestUser();
