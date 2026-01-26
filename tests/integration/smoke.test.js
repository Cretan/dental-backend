/**
 * Smoke Test: Verify Strapi boots for integration testing
 */

const { setupStrapi, cleanupStrapi } = require('../helpers/strapi');

beforeAll(async () => {
  await setupStrapi();
}, 60000);

afterAll(async () => {
  await cleanupStrapi();
});

describe('Strapi Bootstrap', () => {
  test('strapi is defined', () => {
    expect(strapi).toBeDefined();
  });

  test('strapi has document service', () => {
    expect(strapi.documents).toBeDefined();
    expect(typeof strapi.documents).toBe('function');
  });

  test('strapi has db connection', () => {
    expect(strapi.db).toBeDefined();
    expect(strapi.db.connection).toBeDefined();
  });

  test('strapi has HTTP server', () => {
    expect(strapi.server).toBeDefined();
    expect(strapi.server.httpServer).toBeDefined();
  });
});
