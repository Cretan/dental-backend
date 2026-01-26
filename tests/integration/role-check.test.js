/**
 * Role-Check Policy Integration Tests
 *
 * Tests the role-check policy (src/policies/role-check.ts) by calling
 * the compiled policy function directly with mock context objects.
 *
 * The role-check policy is a synchronous function that:
 * - Returns false for unauthenticated users (no user on context)
 * - Returns true for super_admin regardless of config
 * - Returns true if user's role is in the allowed roles list
 * - Returns false (403) if user's role is not in the allowed roles
 * - Returns true if no roles are configured (open to all authenticated)
 * - Returns false (403) if user has no role assigned
 */

const { setupStrapi, cleanupStrapi } = require('../helpers/strapi');

beforeAll(async () => {
  await setupStrapi();
}, 60000);

afterAll(async () => {
  await cleanupStrapi();
});

describe('Role-Check Policy', () => {
  let roleCheck;

  beforeAll(() => {
    // Load the compiled policy from dist
    const policyModule = require('../../dist/src/policies/role-check');
    roleCheck = policyModule.default || policyModule;
  });

  /**
   * Helper to create a mock policy context with a user and role.
   */
  function createMockContext({ userId = 1, roleType = null, roleName = null } = {}) {
    const ctx = {
      state: {},
      status: undefined,
      body: undefined,
    };

    if (userId !== null) {
      ctx.state.user = {
        id: userId,
      };

      if (roleType !== null) {
        ctx.state.user.role = {
          type: roleType,
          name: roleName || roleType,
        };
      }
    }

    return ctx;
  }

  /**
   * Helper to create policy config with allowed roles.
   */
  function createConfig(roles = []) {
    return { roles };
  }

  test('Super admin always passes role check', () => {
    const ctx = createMockContext({
      userId: 1,
      roleType: 'super_admin',
      roleName: 'Super Admin',
    });
    const config = createConfig(['dentist', 'receptionist']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });

  test('Super admin passes even when no roles are configured', () => {
    const ctx = createMockContext({
      userId: 1,
      roleType: 'super_admin',
      roleName: 'Super Admin',
    });
    const config = createConfig([]);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });

  test('User with correct role passes', () => {
    const ctx = createMockContext({
      userId: 2,
      roleType: 'dentist',
      roleName: 'Dentist',
    });
    const config = createConfig(['dentist', 'receptionist', 'cabinet_admin']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
    // No 403 status should be set
    expect(ctx.status).toBeUndefined();
  });

  test('User with wrong role gets 403', () => {
    const ctx = createMockContext({
      userId: 3,
      roleType: 'accountant',
      roleName: 'Accountant',
    });
    const config = createConfig(['dentist', 'receptionist']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(false);
    expect(ctx.status).toBe(403);
    expect(ctx.body).toHaveProperty('error', 'Forbidden');
    expect(ctx.body).toHaveProperty('message');
  });

  test('User without any role gets 403', () => {
    const ctx = createMockContext({
      userId: 4,
      roleType: null, // No role assigned
    });
    const config = createConfig(['dentist']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(false);
    expect(ctx.status).toBe(403);
    expect(ctx.body).toHaveProperty('error', 'Forbidden');
    expect(ctx.body.message).toContain('rol');
  });

  test('No roles configured means open to all authenticated users', () => {
    const ctx = createMockContext({
      userId: 5,
      roleType: 'receptionist',
      roleName: 'Receptionist',
    });
    // Empty roles array = no restriction
    const config = createConfig([]);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });

  test('Undefined config roles means open to all authenticated', () => {
    const ctx = createMockContext({
      userId: 6,
      roleType: 'dentist',
      roleName: 'Dentist',
    });
    // Config with no roles property at all
    const config = {};

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });

  test('Unauthenticated user (no user on context) returns false', () => {
    const ctx = createMockContext({ userId: null });
    const config = createConfig(['dentist']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(false);
  });

  test('cabinet_admin role passes when included in allowed roles', () => {
    const ctx = createMockContext({
      userId: 7,
      roleType: 'cabinet_admin',
      roleName: 'Cabinet Admin',
    });
    const config = createConfig(['super_admin', 'cabinet_admin']);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });

  test('authenticated role type is treated as a normal role', () => {
    const ctx = createMockContext({
      userId: 8,
      roleType: 'authenticated',
      roleName: 'Authenticated',
    });
    const config = createConfig(['dentist', 'cabinet_admin']);

    // 'authenticated' is not in the allowed roles list
    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(false);
    expect(ctx.status).toBe(403);
  });

  test('Multiple valid roles - first matching role grants access', () => {
    const ctx = createMockContext({
      userId: 9,
      roleType: 'receptionist',
      roleName: 'Receptionist',
    });
    const config = createConfig([
      'super_admin',
      'cabinet_admin',
      'dentist',
      'receptionist',
      'accountant',
    ]);

    const result = roleCheck(ctx, config, { strapi });

    expect(result).toBe(true);
  });
});
