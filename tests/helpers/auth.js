/**
 * Auth Test Helpers
 *
 * Provides functions for creating test users, cabinets, and obtaining JWT tokens.
 * Requires a running Strapi test instance (see strapi.js helper).
 */

const bcrypt = require('bcryptjs');

let cabinetCounter = 0;
let patientCounter = 0;

/**
 * Create a test cabinet with all required schema fields.
 * @param {object} strapi - Strapi instance
 * @param {object} opts - Cabinet options
 * @param {string} opts.name - Cabinet name
 * @returns {object} Created cabinet entity
 */
async function createTestCabinet(strapi, { name = 'Test Cabinet' } = {}) {
  cabinetCounter++;
  const cabinet = await strapi.documents('api::cabinet.cabinet').create({
    data: {
      nume_cabinet: `${name} ${cabinetCounter}`,
      adresa: `Str. Test ${cabinetCounter}, Nr. 1, Bucuresti`,
      telefon: `021000${String(cabinetCounter).padStart(4, '0')}`,
      email: `cabinet${cabinetCounter}@test.com`,
      program_functionare: {
        luni: '08:00-18:00',
        marti: '08:00-18:00',
        miercuri: '08:00-18:00',
        joi: '08:00-18:00',
        vineri: '08:00-16:00',
      },
    },
    status: 'published',
  });
  return cabinet;
}

/**
 * Create a test user and link to a cabinet.
 * @param {object} strapi - Strapi instance
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.email
 * @param {string} opts.password
 * @param {string} [opts.roleType] - Role type (e.g., 'authenticated', 'cabinet_admin', 'dentist')
 * @param {number} [opts.cabinetId] - Cabinet ID to link
 * @returns {object} Created user entity
 */
async function createTestUser(strapi, {
  username = 'testuser',
  email = 'test@test.com',
  password = 'Test1234!',
  roleType = 'authenticated',
  cabinetId = null,
} = {}) {
  // Find the role
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
  });

  if (!role) {
    throw new Error(`Role type "${roleType}" not found. Available roles may not be seeded yet.`);
  }

  // Create user via db.query (users don't use Document Service)
  const user = await strapi.db.query('plugin::users-permissions.user').create({
    data: {
      username,
      email,
      password: await bcrypt.hash(password, 10),
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
    },
  });

  // Link user to cabinet if provided
  if (cabinetId) {
    const knex = strapi.db.connection;
    try {
      await knex('up_users_cabinet_lnk').insert({
        user_id: user.id,
        cabinet_id: cabinetId,
      });
    } catch (e) {
      strapi.log.warn(`Could not link user to cabinet: ${e.message}`);
    }
  }

  return user;
}

/**
 * Obtain a JWT token for a user.
 * @param {object} strapi - Strapi instance
 * @param {object} user - User entity (must have `id`)
 * @param {number} [cabinetId] - Cabinet ID to embed in token
 * @returns {string} JWT token string
 */
async function getJWT(strapi, user, cabinetId = null) {
  const payload = { id: user.id };
  if (cabinetId) {
    payload.cabinetId = cabinetId;
  }
  const token = strapi.plugins['users-permissions'].services.jwt.issue(payload);
  return token;
}

/**
 * Create a test patient linked to a cabinet.
 * @param {object} strapi - Strapi instance
 * @param {object} opts
 * @param {number} opts.cabinetId - Cabinet ID
 * @param {string} [opts.cnp] - CNP (defaults to valid test CNP)
 * @returns {object} Created patient entity
 */
async function createTestPatient(strapi, { cabinetId, cnp = '1900101040072' } = {}) {
  patientCounter++;
  const patient = await strapi.documents('api::pacient.pacient').create({
    data: {
      nume: `Popescu${patientCounter}`,
      prenume: `Ion${patientCounter}`,
      cnp,
      telefon: `07${String(10000000 + patientCounter)}`,
      data_nasterii: '1990-01-01',
      cabinet: cabinetId || undefined,
    },
    status: 'published',
  });
  return patient;
}

/**
 * Set up a role with full Content API permissions for testing.
 * Dynamically discovers all available actions from the users-permissions plugin
 * and grants them all to the specified role. This ensures custom controller
 * actions (search, statistics, upcoming, history, etc.) are also granted.
 *
 * @param {object} strapi - Strapi instance
 * @param {string} roleType - Role type (e.g., 'dentist', 'cabinet_admin')
 */
async function setupTestRole(strapi, roleType) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: roleType },
  });

  if (!role) {
    throw new Error(`Role type "${roleType}" not found`);
  }

  // Get all available actions from the users-permissions plugin
  const permSvc = strapi.plugins['users-permissions'].services['users-permissions'];
  const allActions = await permSvc.getActions();

  // Iterate over all API content types and their controller actions
  for (const [apiKey, apiConfig] of Object.entries(allActions)) {
    // Only process api:: content types (skip plugin:: actions)
    if (!apiKey.startsWith('api::')) continue;

    const controllers = apiConfig.controllers || {};
    for (const [controllerName, controllerActions] of Object.entries(controllers)) {
      for (const actionName of Object.keys(controllerActions)) {
        const fullAction = `${apiKey}.${controllerName}.${actionName}`;

        // Check if permission already exists
        const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: {
            action: fullAction,
            role: role.id,
          },
        });

        if (!existing) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              action: fullAction,
              role: role.id,
              enabled: true,
            },
          });
        }
      }
    }
  }
}

module.exports = {
  createTestCabinet,
  createTestUser,
  getJWT,
  createTestPatient,
  setupTestRole,
};
