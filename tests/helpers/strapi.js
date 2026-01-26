/**
 * Strapi Test Instance Helper
 *
 * Boots a real Strapi instance with SQLite for integration tests.
 * Based on official Strapi v5 testing docs.
 *
 * Usage:
 *   const { setupStrapi, cleanupStrapi } = require('./helpers/strapi');
 *   beforeAll(async () => { await setupStrapi(); }, 60000);
 *   afterAll(async () => { await cleanupStrapi(); });
 *   // `strapi` is available as a global after setup
 */

const fs = require('fs');
const path = require('path');

let instance;

const appDir = path.resolve(__dirname, '..', '..');
const distDir = path.join(appDir, 'dist');

/**
 * Boot a Strapi instance for testing.
 * Uses a file-based SQLite database (cleaned up after tests).
 * Requires `npm run build` to have been run first (uses dist/).
 */
async function setupStrapi() {
  if (instance) {
    return instance;
  }

  // Force test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_CLIENT = 'sqlite';
  process.env.DATABASE_FILENAME = '.tmp/test.db';
  process.env.STRAPI_DISABLE_AUTO_RELOAD = 'true';
  // Use test secrets
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
  process.env.APP_KEYS = 'testkey1,testkey2,testkey3,testkey4';
  process.env.API_TOKEN_SALT = 'test-api-token-salt';
  process.env.TRANSFER_TOKEN_SALT = 'test-transfer-token-salt';

  // Strapi v5: use the named export createStrapi
  const { createStrapi } = require('@strapi/strapi');

  await createStrapi({ appDir, distDir }).load();
  instance = strapi; // Strapi sets global.strapi during load()

  await instance.server.mount();

  return instance;
}

/**
 * Tear down the Strapi instance and clean up the test database.
 */
async function cleanupStrapi() {
  if (!instance) return;

  const dbSettings = strapi.config.get('database.connection');

  // Use Strapi's built-in destroy method (handles server + db + pool cleanup)
  try {
    await strapi.destroy();
  } catch (e) {
    // Fallback: try manual cleanup if destroy fails
    try { await strapi.server.httpServer.close(); } catch (_) { /* ignore */ }
    try { await strapi.db.connection.destroy(); } catch (_) { /* ignore */ }
  }

  // Delete test database file
  if (dbSettings && dbSettings.connection && dbSettings.connection.filename) {
    const tmpDbFile = dbSettings.connection.filename;
    if (fs.existsSync(tmpDbFile)) {
      fs.unlinkSync(tmpDbFile);
    }
  }

  // Clear references so the next test file can boot a fresh instance
  instance = null;
  delete global.strapi;
}

module.exports = {
  setupStrapi,
  cleanupStrapi,
};
