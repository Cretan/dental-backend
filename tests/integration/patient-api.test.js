/**
 * Patient API Integration Tests
 *
 * Tests the patient CRUD endpoints (src/api/pacient/controllers/pacient.ts).
 *
 * Verifies:
 * - Create patient with valid data succeeds
 * - Create patient with invalid CNP returns 400
 * - Create patient with missing required fields returns 400
 * - Update patient returns 200
 * - Search patients by name returns matches
 * - Search with empty query returns 400
 * - Patient statistics endpoint returns correct shape
 * - Duplicate CNP returns 400
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

describe('Patient API', () => {
  let cabinet;
  let user;
  let jwt;
  let createdPatientDocumentId;

  beforeAll(async () => {
    // Grant Content API permissions to the cabinet_admin role
    await setupTestRole(strapi, 'cabinet_admin');

    cabinet = await createTestCabinet(strapi, { name: 'Patient API Test Cabinet' });

    user = await createTestUser(strapi, {
      username: 'patient_api_user',
      email: 'patient_api@test.com',
      password: 'PatientTest123!',
      roleType: 'cabinet_admin',
      cabinetId: cabinet.id,
    });

    jwt = await getJWT(strapi, user, cabinet.id);
  });

  describe('Create Patient', () => {
    test('Create patient with valid data returns 200/201 and data', async () => {
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'Popescu',
            prenume: 'Maria',
            cnp: '1900101040072',
            telefon: '0712345678',
            data_nasterii: '1990-01-01',
            cabinet: cabinet.id,
          },
        });

      // Strapi v5 returns 201 for successful POST
      expect([200, 201]).toContain(res.status);

      expect(res.body).toHaveProperty('data');
      const patient = res.body.data;
      expect(patient).toBeDefined();

      // Store documentId for update test
      createdPatientDocumentId = patient.documentId || patient.attributes?.documentId;
      expect(createdPatientDocumentId).toBeDefined();

      // Verify the returned data contains the correct fields
      const patientData = patient.attributes || patient;
      expect(patientData.nume || patientData.attributes?.nume).toBeDefined();
    });

    test('Create patient with invalid CNP returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'InvalidCnp',
            prenume: 'Test',
            cnp: '0000000000000', // Invalid: first digit must be 1-8, bad checksum
            telefon: '0712345670',
            data_nasterii: '1990-01-01',
            cabinet: cabinet.id,
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Create patient with too-short CNP returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'ShortCnp',
            prenume: 'Test',
            cnp: '12345', // Way too short
            telefon: '0712345671',
            data_nasterii: '1990-01-01',
            cabinet: cabinet.id,
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Create patient with missing required fields returns 400', async () => {
      // Missing nume and prenume
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            cnp: '2850101040052',
            telefon: '0712345672',
            data_nasterii: '1985-01-01',
            cabinet: cabinet.id,
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Create patient with missing phone returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'NoPhone',
            prenume: 'Test',
            cnp: '2850101040052',
            data_nasterii: '1985-01-01',
            cabinet: cabinet.id,
            // telefon is missing
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Create patient with missing birth date returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'NoBirth',
            prenume: 'Test',
            cnp: '2850101040052',
            telefon: '0712345673',
            cabinet: cabinet.id,
            // data_nasterii is missing
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Create patient with duplicate CNP returns 400', async () => {
      // First, the CNP '1900101040072' was already created in the valid test above
      const res = await request(strapi.server.httpServer)
        .post('/api/pacients')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            nume: 'Duplicate',
            prenume: 'Cnp',
            cnp: '1900101040072', // Already exists from first test
            telefon: '0712345674',
            data_nasterii: '1990-01-01',
            cabinet: cabinet.id,
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Update Patient', () => {
    test('Update patient returns 200', async () => {
      // We need the documentId from the previously created patient
      expect(createdPatientDocumentId).toBeDefined();

      const res = await request(strapi.server.httpServer)
        .put(`/api/pacients/${createdPatientDocumentId}`)
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            prenume: 'MariaUpdated',
            telefon: '0722222222',
          },
        })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      const updated = res.body.data;
      const updatedData = updated.attributes || updated;
      // Verify the update took effect
      const updatedPrenume = updatedData.prenume || updatedData.attributes?.prenume;
      if (updatedPrenume) {
        expect(updatedPrenume).toBe('MariaUpdated');
      }
    });

    test('Update patient with invalid phone returns 400', async () => {
      expect(createdPatientDocumentId).toBeDefined();

      const res = await request(strapi.server.httpServer)
        .put(`/api/pacients/${createdPatientDocumentId}`)
        .set('Authorization', `Bearer ${jwt}`)
        .set('Content-Type', 'application/json')
        .send({
          data: {
            telefon: 'not-a-phone-number',
          },
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Search Patients', () => {
    test('Search patients by name returns matches', async () => {
      // Search for the patient we created ('Popescu')
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/search?query=Popescu')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      // The search endpoint returns an array directly (not wrapped in { data })
      expect(Array.isArray(res.body) || res.body.data).toBeTruthy();

      const results = Array.isArray(res.body) ? res.body : res.body.data;
      if (Array.isArray(results)) {
        // Should find at least one match
        expect(results.length).toBeGreaterThan(0);
        // Verify at least one result has the name we searched for
        const hasMatch = results.some(
          (p) => (p.nume || p.attributes?.nume || '').toLowerCase().includes('popescu')
        );
        expect(hasMatch).toBe(true);
      }
    });

    test('Search patients by CNP returns matches', async () => {
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/search?query=1900101040072')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      const results = Array.isArray(res.body) ? res.body : res.body.data;
      if (Array.isArray(results)) {
        expect(results.length).toBeGreaterThan(0);
      }
    });

    test('Search with empty query returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/search?query=')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });

    test('Search without query parameter returns 400', async () => {
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/search')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(400);

      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Patient Statistics', () => {
    test('Statistics endpoint returns correct shape', async () => {
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/statistics')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      // The statistics endpoint returns an object with specific fields
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(0);

      expect(res.body).toHaveProperty('ageDistribution');
      expect(Array.isArray(res.body.ageDistribution)).toBe(true);

      expect(res.body).toHaveProperty('byCabinet');
      expect(Array.isArray(res.body.byCabinet)).toBe(true);

      expect(res.body).toHaveProperty('timestamp');
      expect(typeof res.body.timestamp).toBe('string');
      // Timestamp should be a valid ISO date
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    test('Statistics total reflects created patients', async () => {
      const res = await request(strapi.server.httpServer)
        .get('/api/pacients/statistics')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(200);

      // We created at least 1 patient in this cabinet
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
  });
});
