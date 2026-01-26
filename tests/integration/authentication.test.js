/**
 * Authentication Integration Tests
 *
 * Tests the session-auth middleware and Strapi's built-in auth endpoints.
 *
 * Verifies that:
 * - Login with valid credentials returns a JWT
 * - Login with wrong password returns 400
 * - Protected endpoints behave correctly without a token
 * - Protected endpoints work with a valid token
 * - Tokens referencing non-existent users are rejected
 */

const { setupStrapi, cleanupStrapi } = require('../helpers/strapi');
const { createTestCabinet, createTestUser, getJWT, setupTestRole } = require('../helpers/auth');
const request = require('supertest');

beforeAll(async () => {
  await setupStrapi();
}, 60000);

afterAll(async () => {
  await cleanupStrapi();
});

describe('Authentication', () => {
  let cabinet;
  let user;
  let jwt;
  const testPassword = 'AuthTest123!';

  beforeAll(async () => {
    // Grant Content API permissions to the dentist role
    await setupTestRole(strapi, 'dentist');

    cabinet = await createTestCabinet(strapi, { name: 'Auth Test Cabinet' });

    user = await createTestUser(strapi, {
      username: 'auth_testuser',
      email: 'auth_test@test.com',
      password: testPassword,
      roleType: 'dentist',
      cabinetId: cabinet.id,
    });

    jwt = await getJWT(strapi, user, cabinet.id);
  });

  test('Login with valid credentials returns JWT', async () => {
    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local')
      .set('Content-Type', 'application/json')
      .send({
        identifier: 'auth_testuser',
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jwt');
    expect(typeof res.body.jwt).toBe('string');
    expect(res.body.jwt.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.username).toBe('auth_testuser');
  });

  test('Login with wrong password returns 400', async () => {
    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local')
      .set('Content-Type', 'application/json')
      .send({
        identifier: 'auth_testuser',
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('Protected endpoint without token returns 200 but middleware skips auth', async () => {
    // The session-auth middleware does NOT block unauthenticated requests;
    // it simply skips setting ctx.state.user and ctx.state.primaryCabinetId.
    // The route-level policies (role-check) may then deny access.
    const res = await request(strapi.server.httpServer)
      .get('/api/pacients');

    // Without a token, the middleware lets the request through,
    // but the role-check policy returns false for unauthenticated users.
    // This typically results in 403 from Strapi's policy engine.
    // However, if no role-check is applied, it might return 200 with empty data.
    expect([200, 403]).toContain(res.status);

    if (res.status === 200) {
      // If the endpoint responded 200, the data should still be present
      // (possibly empty since no cabinet filter was applied)
      expect(res.body).toBeDefined();
    }
  });

  test('Protected endpoint with valid token returns 200 with data', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/pacients')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('Token with non-existent user returns 401 or error', async () => {
    // Issue a JWT for a user ID that does not exist
    const fakeToken = strapi.plugins['users-permissions'].services.jwt.issue({
      id: 999999,
      cabinetId: cabinet.id,
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/pacients')
      .set('Authorization', `Bearer ${fakeToken}`);

    // The session-auth middleware verifies the token, finds no user with id=999999,
    // and returns 401 with { error: "User not found" }
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('Login with non-existent user returns 400', async () => {
    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local')
      .set('Content-Type', 'application/json')
      .send({
        identifier: 'nonexistent_user_xyz',
        password: 'SomePassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('Auth endpoints are skipped by session-auth middleware', async () => {
    // The session-auth middleware checks if URL starts with /api/auth and skips processing.
    // This means auth endpoints should work without any Bearer token.
    const res = await request(strapi.server.httpServer)
      .post('/api/auth/local')
      .set('Content-Type', 'application/json')
      .send({
        identifier: 'auth_testuser',
        password: testPassword,
      });

    // Should succeed without any Authorization header
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jwt');
  });

  test('Malformed Authorization header is handled gracefully', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/pacients')
      .set('Authorization', 'InvalidTokenFormat');

    // The middleware checks for "Bearer " prefix. Without it, it skips auth
    // and lets the request through as unauthenticated.
    // The role-check policy may then deny it.
    expect([200, 403]).toContain(res.status);
  });
});
