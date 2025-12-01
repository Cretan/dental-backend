/**
 * Phase 2 Testing: Treatment Plan Management
 * Tests: Auto-calculation, validation, summary, cost calculation, discount, invoice generation
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_BASE = `${STRAPI_URL}/api`;
const TIMEOUT = 10000;
const MAX_RETRIES = 3;

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
};

// Store created IDs for cleanup
let createdPatientId = null;
let createdCabinetId = null;
let createdPlanIds = [];

/**
 * Check if Strapi is healthy and responding
 */
async function checkStrapiHealth() {
  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      const response = await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
      if (response.status === 200 || response.status === 204) {
        return true;
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`${colors.yellow}⏳ Strapi not responding, attempt ${attempts + 1}/${MAX_RETRIES}...${colors.reset}`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        // Strapi might be running but _health endpoint doesn't exist
        try {
          await axios.get(`${API_BASE}/pacients`, { timeout: 5000 });
          return true;
        } catch {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  }
  return false;
}

/**
 * Log test result
 */
function logTest(name, passed, message = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } else {
    testResults.failed++;
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (message) {
      console.log(`  ${colors.gray}${message}${colors.reset}`);
    }
  }
}

/**
 * Setup: Create a test patient and cabinet
 */
async function setupTestData() {
  console.log(`\n${colors.cyan}═══ Setting up test data ═══${colors.reset}\n`);

  try {
    // Create test patient with unique data and VALID CNP
    const timestamp = Date.now().toString().slice(-4);
    const name = generateRomanianName('F');
    const birthYear = 1980 + Math.floor(Math.random() * 10); // 1980-1990
    const birthMonth = 6;
    const birthDay = 21;
    const sequence = Math.floor(Math.random() * 800) + 100; // 100-899
    
    const validCNP = generateValidCNP({
      year: birthYear,
      month: birthMonth,
      day: birthDay,
      gender: 'F',
      sequence: sequence
    });
    
    const patientResponse = await axios.post(
      `${API_BASE}/pacients`,
      {
        data: {
          nume: name.lastName,
          prenume: name.firstName,
          cnp: validCNP,
          data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
          telefon: `+4070022${timestamp}`,
          email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${timestamp}@test.ro`,
          published_at: new Date().toISOString(),
        },
      },
      { timeout: TIMEOUT }
    );
    createdPatientId = patientResponse.data.data.id;
    console.log(`${colors.green}✓${colors.reset} Created test patient (ID: ${createdPatientId})`);

    // Create test cabinet with unique identifiers
    const uniquePhone = `+40700${Math.floor(100000 + Math.random() * 900000)}`;
    const uniqueEmail = `cabinet.phase2.${timestamp}.${Math.floor(Math.random() * 1000)}@test.ro`;
    const cabinetResponse = await axios.post(
      `${API_BASE}/cabinets`,
      {
        data: {
          nume_cabinet: `Cabinet Stomatologic ${timestamp}`,
          adresa: 'Str. Test nr. 2',
          telefon: uniquePhone,
          email: uniqueEmail,
          program_functionare: { luni: '9-17', marti: '9-17' },
        },
      },
      { timeout: TIMEOUT }
    );
    createdCabinetId = cabinetResponse.data.data.id;
    console.log(`${colors.green}✓${colors.reset} Created test cabinet (ID: ${createdCabinetId})`);

    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed to setup test data:${colors.reset}`, error.response?.data || error.message);
    
    // Specific guidance for 403 errors
    if (error.response?.status === 403) {
      console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      console.log(`${colors.yellow}⚠️  PERMISSION ERROR - Action Required:${colors.reset}\n`);
      console.log(`${colors.cyan}Please enable Cabinet API permissions:${colors.reset}`);
      console.log(`  1. Go to: ${colors.gray}http://localhost:1337/admin${colors.reset}`);
      console.log(`  2. Navigate to: ${colors.gray}Settings → Users & Permissions → Roles → Public${colors.reset}`);
      console.log(`  3. Enable for ${colors.green}Cabinet${colors.reset}: find, findOne, create, update, delete`);
      console.log(`  4. Enable for ${colors.green}Plan-tratament${colors.reset}: find, findOne, create, update, delete`);
      console.log(`  5. Click ${colors.green}Save${colors.reset}`);
      console.log(`  6. Re-run: ${colors.cyan}npm test${colors.reset}\n`);
      console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    }
    
    return false;
  }
}

/**
 * Cleanup: Delete all created test data
 */
async function cleanup() {
  console.log(`\n${colors.cyan}═══ Cleaning up test data ═══${colors.reset}\n`);

  // Delete treatment plans
  for (const planId of createdPlanIds) {
    try {
      await axios.delete(`${API_BASE}/plan-trataments/${planId}`, { timeout: TIMEOUT });
      console.log(`${colors.gray}Deleted plan ${planId}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Could not delete plan ${planId}${colors.reset}`);
    }
  }

  // Delete patient
  if (createdPatientId) {
    try {
      await axios.delete(`${API_BASE}/pacients/${createdPatientId}`, { timeout: TIMEOUT });
      console.log(`${colors.gray}Deleted patient ${createdPatientId}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Could not delete patient${colors.reset}`);
    }
  }

  // Delete cabinet
  if (createdCabinetId) {
    try {
      await axios.delete(`${API_BASE}/cabinets/${createdCabinetId}`, { timeout: TIMEOUT });
      console.log(`${colors.gray}Deleted cabinet ${createdCabinetId}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}Could not delete cabinet${colors.reset}`);
    }
  }
}

/**
 * Test 2.8: Treatment Plan Validation
 */
async function testTreatmentPlanValidation() {
  console.log(`\n${colors.cyan}═══ Test 2.8: Treatment Plan Validation ═══${colors.reset}\n`);

  // Test: Missing patient
  try {
    await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          tratamente: [{ tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150 }],
        },
      },
      { timeout: TIMEOUT }
    );
    logTest('Missing patient validation', false, 'Should have rejected request without patient');
  } catch (error) {
    logTest('Missing patient validation', error.response?.status === 400, 'Correctly rejected missing patient');
  }

  // Test: Patient doesn't exist
  try {
    await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: 999999,
          tratamente: [{ tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150 }],
        },
      },
      { timeout: TIMEOUT }
    );
    logTest('Non-existent patient validation', false, 'Should have rejected non-existent patient');
  } catch (error) {
    logTest('Non-existent patient validation', error.response?.status === 400, 'Correctly rejected non-existent patient');
  }

  // Test: Empty treatments array
  try {
    await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          tratamente: [],
        },
      },
      { timeout: TIMEOUT }
    );
    logTest('Empty treatments validation', false, 'Should have rejected empty treatments');
  } catch (error) {
    logTest('Empty treatments validation', error.response?.status === 400, 'Correctly rejected empty treatments');
  }

  // Test: Negative price
  try {
    await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          tratamente: [{ tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: -50 }],
        },
      },
      { timeout: TIMEOUT }
    );
    logTest('Negative price validation', false, 'Should have rejected negative price');
  } catch (error) {
    logTest('Negative price validation', error.response?.status === 400, 'Correctly rejected negative price');
  }
}

/**
 * Test 2.9: Auto-Calculation
 */
async function testAutoCalculation() {
  console.log(`\n${colors.cyan}═══ Test 2.9: Auto-Calculation ═══${colors.reset}\n`);

  try {
    // Create plan with multiple treatments
    const response = await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          tratamente: [
            { tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150.50 },
            { tip_procedura: 'Extractie', numar_dinte: null, pret: 200.25 },
            { tip_procedura: 'Extractie', numar_dinte: 'dinte_1.8', pret: 100.75 },
          ],
        },
      },
      { timeout: TIMEOUT }
    );

    const plan = response.data.data;
    createdPlanIds.push(plan.id);
    
    // Store documentId for update (Strapi v5 uses documentId for updates)
    const planDocumentId = plan.documentId || plan.attributes?.documentId || plan.id;

    // Expected total: 150.50 + 200.25 + 100.75 = 451.50
    const expectedTotal = 451.50;
    const actualTotal = plan.attributes?.pret_total;

    logTest(
      'Auto-calculate pret_total',
      Math.abs(actualTotal - expectedTotal) < 0.01,
      `Expected: ${expectedTotal}, Got: ${actualTotal}`
    );

    logTest('Auto-set data_creare', plan.attributes?.data_creare !== null && plan.attributes?.data_creare !== undefined, 'data_creare should be set');

    // Check if first treatment has status_tratament set to Planificat
    const firstTreatmentStatus = plan.attributes?.tratamente?.[0]?.status_tratament;
    logTest(
      'Auto-set status_tratament',
      firstTreatmentStatus === 'Planificat',
      `Expected: Planificat, Got: ${firstTreatmentStatus}`
    );

    // Test: Update plan and recalculate
    const updateResponse = await axios.put(
      `${API_BASE}/plan-trataments/${planDocumentId}`,
      {
        data: {
          tratamente: [
            { tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 200 },
            { tip_procedura: 'Extractie', numar_dinte: null, pret: 300 },
          ],
        },
      },
      { timeout: TIMEOUT }
    );

    const updatedPlan = updateResponse.data.data;
    const newExpectedTotal = 500;
    const newActualTotal = updatedPlan.attributes?.pret_total;

    logTest(
      'Recalculate on update',
      Math.abs(newActualTotal - newExpectedTotal) < 0.01,
      `Expected: ${newExpectedTotal}, Got: ${newActualTotal}`
    );
  } catch (error) {
    console.log('  Debug - Auto-calc error:', error.response?.status, error.response?.data?.error?.message || error.message);
    logTest('Auto-calculation tests', false, error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2.11: Treatment Summary
 */
async function testTreatmentSummary() {
  console.log(`\n${colors.cyan}═══ Test 2.11: Treatment Summary ═══${colors.reset}\n`);

  try {
    // Create a plan with diverse treatments
    const response = await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          cabinet: createdCabinetId,
          tratamente: [
            { tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150, status_tratament: 'Planificat' },
            { tip_procedura: 'Canal', numar_dinte: 'dinte_1.7', pret: 150, status_tratament: 'In_progres' },
            { tip_procedura: 'Extractie', numar_dinte: null, pret: 200, status_tratament: 'Finalizat' },
            { tip_procedura: 'Extractie', numar_dinte: 'dinte_1.8', pret: 100, status_tratament: 'Planificat' },
          ],
        },
      },
      { timeout: TIMEOUT }
    );

    const planId = response.data.data.id;
    createdPlanIds.push(planId);

    // Get summary
    const summaryResponse = await axios.get(`${API_BASE}/plan-trataments/${planId}/summary`, { timeout: TIMEOUT });
    const summary = summaryResponse.data;

    logTest('Summary returns patient info', summary.patient !== null && summary.patient !== undefined, 'Patient info present');

    logTest('Summary returns cabinet info', summary.cabinet !== null && summary.cabinet !== undefined, 'Cabinet info present');

    logTest(
      'Summary returns correct total',
      Math.abs(summary.statistics.totalPrice - 600) < 0.01,
      `Expected: 600, Got: ${summary.statistics.totalPrice}`
    );

    logTest('Summary returns treatment count', summary.statistics.totalTreatments === 4, `Expected: 4, Got: ${summary.statistics.totalTreatments}`);

    logTest(
      'Summary counts by status',
      summary.statistics.byStatus && summary.statistics.byStatus.Planificat === 2,
      `Planificat count: ${summary.statistics.byStatus?.Planificat}`
    );

    logTest(
      'Summary counts by type',
      summary.statistics.byType && summary.statistics.byType.Canal === 2,
      `Canal count: ${summary.statistics.byType?.Canal}`
    );

    // Test: Summary for non-existent plan
    try {
      await axios.get(`${API_BASE}/plan-trataments/999999/summary`, { timeout: TIMEOUT });
      logTest('Summary 404 for non-existent plan', false, 'Should return 404');
    } catch (error) {
      logTest('Summary 404 for non-existent plan', error.response?.status === 404, 'Correctly returned 404');
    }
  } catch (error) {
    logTest('Treatment summary tests', false, error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2.12: Price Calculation Endpoint
 */
async function testPriceCalculation() {
  console.log(`\n${colors.cyan}═══ Test 2.12: Price Calculation Endpoint ═══${colors.reset}\n`);

  try {
    // Test: Calculate cost with valid treatments
    const response = await axios.post(
      `${API_BASE}/plan-trataments/calculate-cost`,
      {
        tratamente: [
          { tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150 },
          { tip_procedura: 'Canal', numar_dinte: 'dinte_1.7', pret: 150 },
          { tip_procedura: 'Extractie', numar_dinte: null, pret: 200 },
        ],
      },
      { timeout: TIMEOUT }
    );

    const result = response.data;

    logTest('Calculate cost returns total', Math.abs(result.total - 500) < 0.01, `Expected: 500, Got: ${result.total}`);

    logTest('Calculate cost returns treatment count', result.treatmentCount === 3, `Expected: 3, Got: ${result.treatmentCount}`);

    logTest(
      'Calculate cost returns average',
      Math.abs(result.averagePerTreatment - 166.67) < 0.1,
      `Expected: ~166.67, Got: ${result.averagePerTreatment}`
    );

    logTest(
      'Calculate cost counts by type',
      result.countsByType && result.countsByType.Canal === 2,
      `Canal count: ${result.countsByType?.Canal}`
    );

    // Test: Empty treatments array
    try {
      await axios.post(`${API_BASE}/plan-trataments/calculate-cost`, { tratamente: [] }, { timeout: TIMEOUT });
      logTest('Calculate cost rejects empty array', false, 'Should reject empty treatments');
    } catch (error) {
      logTest('Calculate cost rejects empty array', error.response?.status === 400, 'Correctly rejected empty array');
    }

    // Test: Missing tratamente field
    try {
      await axios.post(`${API_BASE}/plan-trataments/calculate-cost`, {}, { timeout: TIMEOUT });
      logTest('Calculate cost requires tratamente', false, 'Should require tratamente field');
    } catch (error) {
      logTest('Calculate cost requires tratamente', error.response?.status === 400, 'Correctly required tratamente');
    }
  } catch (error) {
    logTest('Price calculation tests', false, error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2.13: Discount Calculation
 */
async function testDiscountCalculation() {
  console.log(`\n${colors.cyan}═══ Test 2.13: Discount Calculation ═══${colors.reset}\n`);

  try {
    // Create a plan for discount testing
    const response = await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          tratamente: [{ tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 1000 }],
        },
      },
      { timeout: TIMEOUT }
    );

    const planId = response.data.data.id;
    createdPlanIds.push(planId);

    // Test: Apply 10% discount
    const discount10Response = await axios.post(
      `${API_BASE}/plan-trataments/${planId}/apply-discount`,
      { discount_percent: 10 },
      { timeout: TIMEOUT }
    );

    const discount10 = discount10Response.data;
    logTest(
      'Apply 10% discount',
      Math.abs(discount10.total - 900) < 0.01,
      `Expected: 900, Got: ${discount10.total}`
    );
    logTest(
      '10% discount amount',
      Math.abs(discount10.discount_amount - 100) < 0.01,
      `Expected: 100, Got: ${discount10.discount_amount}`
    );

    // Test: Apply 50% discount
    const discount50Response = await axios.post(
      `${API_BASE}/plan-trataments/${planId}/apply-discount`,
      { discount_percent: 50 },
      { timeout: TIMEOUT }
    );

    const discount50 = discount50Response.data;
    logTest(
      'Apply 50% discount',
      Math.abs(discount50.total - 500) < 0.01,
      `Expected: 500, Got: ${discount50.total}`
    );

    // Test: Apply 100% discount (free)
    const discount100Response = await axios.post(
      `${API_BASE}/plan-trataments/${planId}/apply-discount`,
      { discount_percent: 100 },
      { timeout: TIMEOUT }
    );

    const discount100 = discount100Response.data;
    logTest('Apply 100% discount (free)', Math.abs(discount100.total - 0) < 0.01, `Expected: 0, Got: ${discount100.total}`);

    // Test: Apply 0% discount
    const discount0Response = await axios.post(
      `${API_BASE}/plan-trataments/${planId}/apply-discount`,
      { discount_percent: 0 },
      { timeout: TIMEOUT }
    );

    const discount0 = discount0Response.data;
    logTest(
      'Apply 0% discount (no change)',
      Math.abs(discount0.total - 1000) < 0.01,
      `Expected: 1000, Got: ${discount0.total}`
    );

    // Test: Negative discount
    try {
      await axios.post(`${API_BASE}/plan-trataments/${planId}/apply-discount`, { discount_percent: -10 }, { timeout: TIMEOUT });
      logTest('Reject negative discount', false, 'Should reject negative discount');
    } catch (error) {
      logTest('Reject negative discount', error.response?.status === 400, 'Correctly rejected negative discount');
    }

    // Test: Discount > 100%
    try {
      await axios.post(`${API_BASE}/plan-trataments/${planId}/apply-discount`, { discount_percent: 150 }, { timeout: TIMEOUT });
      logTest('Reject discount > 100%', false, 'Should reject discount > 100%');
    } catch (error) {
      logTest('Reject discount > 100%', error.response?.status === 400, 'Correctly rejected discount > 100%');
    }
  } catch (error) {
    logTest('Discount calculation tests', false, error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2.14: Invoice Generation
 */
async function testInvoiceGeneration() {
  console.log(`\n${colors.cyan}═══ Test 2.14: Invoice Generation ═══${colors.reset}\n`);

  try {
    // Create initial plan
    const response = await axios.post(
      `${API_BASE}/plan-trataments`,
      {
        data: {
          pacient: createdPatientId,
          cabinet: createdCabinetId,
          tratamente: [
            { tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150 },
            { tip_procedura: 'Extractie', numar_dinte: null, pret: 200 },
          ],
        },
      },
      { timeout: TIMEOUT }
    );

    const planId = response.data.data.id;
    createdPlanIds.push(planId);

    // Test: Generate invoice without initial_tratamente
    const invoice1Response = await axios.post(`${API_BASE}/plan-trataments/${planId}/generate-invoice`, {}, { timeout: TIMEOUT });

    const invoice1 = invoice1Response.data;
    logTest('Invoice includes patient info', invoice1.patient !== null && invoice1.patient !== undefined, 'Patient info present');
    logTest('Invoice includes cabinet info', invoice1.cabinet !== null && invoice1.cabinet !== undefined, 'Cabinet info present');
    logTest('Invoice has invoice number', invoice1.invoice_number !== null && invoice1.invoice_number !== undefined, 'Invoice number present');
    logTest('Invoice has date', invoice1.date !== null && invoice1.date !== undefined, 'Invoice date present');
    logTest('Invoice has procedures', invoice1.procedures && Object.keys(invoice1.procedures).length > 0, `Expected procedures, Got: ${Object.keys(invoice1.procedures || {}).length} types`);

    // Test: Generate invoice with initial_tratamente (calculate "new" procedures)
    const invoice2Response = await axios.post(
      `${API_BASE}/plan-trataments/${planId}/generate-invoice`,
      {
        initial_tratamente: [{ tip_procedura: 'Canal', numar_dinte: 'dinte_1.6', pret: 150 }],
      },
      { timeout: TIMEOUT }
    );

    const invoice2 = invoice2Response.data;
    logTest(
      'Invoice calculates new procedures',
      invoice2.summary && invoice2.summary.procedureCount === 1,
      `Expected 1 new procedure, Got: ${invoice2.summary?.procedureCount}`
    );

    // Test: Invoice for non-existent plan
    try {
      await axios.post(`${API_BASE}/plan-trataments/999999/generate-invoice`, {}, { timeout: TIMEOUT });
      logTest('Invoice 404 for non-existent plan', false, 'Should return 404');
    } catch (error) {
      logTest('Invoice 404 for non-existent plan', error.response?.status === 404, 'Correctly returned 404');
    }
  } catch (error) {
    logTest('Invoice generation tests', false, error.response?.data?.error?.message || error.message);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║         Phase 2 Testing: Treatment Plan Management        ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Check Strapi health
  console.log(`${colors.yellow}⏳ Checking if Strapi is running...${colors.reset}`);
  const isHealthy = await checkStrapiHealth();

  if (!isHealthy) {
    console.error(`\n${colors.red}✗ Strapi is not responding. Please start it with: npm run develop${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ Strapi is running${colors.reset}`);

  // Setup test data
  const setupSuccess = await setupTestData();
  if (!setupSuccess) {
    console.error(`\n${colors.red}✗ Failed to setup test data${colors.reset}\n`);
    process.exit(1);
  }

  // Run all tests
  await testTreatmentPlanValidation();
  await testAutoCalculation();
  await testTreatmentSummary();
  await testPriceCalculation();
  await testDiscountCalculation();
  await testInvoiceGeneration();


  // Cleanup all test data before Strapi stops
  try {
    console.log(`\n${colors.yellow}🧹 Cleaning up all test data before exit...${colors.reset}`);
    await axios.post(`${STRAPI_URL}/cleanup-database`, {}, { timeout: TIMEOUT });
    console.log(`${colors.green}✅ Cleanup complete.${colors.reset}`);
  } catch (cleanupError) {
    console.log(`${colors.red}❌ Cleanup failed: ${cleanupError.message}${colors.reset}`);
  }

  // Print results
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}                      TEST RESULTS                         ${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);

  const passRate = testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0;

  console.log(`  Total Tests:  ${testResults.total}`);
  console.log(`  ${colors.green}Passed:       ${testResults.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:       ${testResults.failed}${colors.reset}`);
  console.log(`  Pass Rate:    ${passRate}%\n`);

  if (testResults.failed === 0) {
    console.log(`${colors.green}✓ All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(`\n${colors.red}✗ Unexpected error:${colors.reset}`, error);
  process.exit(1);
});

