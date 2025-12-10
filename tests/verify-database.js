/**
 * Database Verification Script
 * Verifică conținutul bazei de date și raportează statistici
 * 
 * Usage: node tests/verify-database.js
 */

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const TIMEOUT = 30000;
const API_TOKEN = '11c77e75e59c95a7487a442d6df8c54727e674a2cb233ea37dc5ed3c51cfcf6588896d1b93161f658266768aa31240696f38a36d3ffa6989256b7b679c8bf7751b56dda969edb72e3d129ede081b914d789b34659d9c9fc3647111fd9d75ea3bbe3ee51a3aef3f0948549d37bed73c5569f00b277ab036af0aa1cafa42140379';
const HEADERS = { headers: { Authorization: `Bearer ${API_TOKEN}` } };

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Get count for an entity
 */
async function getEntityCount(endpoint, entityName) {
  try {
    const response = await axios.get(`${API_BASE}/${endpoint}?pagination[limit]=1`, {
      timeout: TIMEOUT,
      ...HEADERS
    });
    
    if (response.data && response.data.meta && response.data.meta.pagination) {
      return response.data.meta.pagination.total;
    }
    
    return 0;
  } catch (error) {
    log(`✗ Error getting ${entityName} count: ${error.message}`, 'red');
    return 0;
  }
}

/**
 * Get detailed cabinet statistics
 */
async function getCabinetStatistics() {
  try {
    const response = await axios.get(`${API_BASE}/cabinets?pagination[limit]=100`, {
      timeout: TIMEOUT,
      ...HEADERS
    });
    
    const cabinets = response.data.data || [];
    const cabinetStats = [];
    
    for (const cabinet of cabinets) {
      const name = cabinet.attributes?.nume_cabinet || 'Unknown';
      
      // Count patients for this cabinet
      const patientsResp = await axios.get(
        `${API_BASE}/pacients?filters[cabinet][id][$eq]=${cabinet.id}&pagination[limit]=1`,
        { timeout: TIMEOUT, ...HEADERS }
      );
      const patientCount = patientsResp.data.meta?.pagination?.total || 0;
      
      // Count visits for this cabinet
      const visitsResp = await axios.get(
        `${API_BASE}/vizitas?filters[cabinet][id][$eq]=${cabinet.id}&pagination[limit]=1`,
        { timeout: TIMEOUT, ...HEADERS }
      );
      const visitCount = visitsResp.data.meta?.pagination?.total || 0;
      
      // Count future appointments (next 2 months)
      const now = new Date();
      const twoMonthsFromNow = new Date(now);
      twoMonthsFromNow.setMonth(now.getMonth() + 2);
      
      const futureVisitsResp = await axios.get(
        `${API_BASE}/vizitas?filters[cabinet][id][$eq]=${cabinet.id}&filters[data_programare][$gte]=${now.toISOString()}&filters[data_programare][$lte]=${twoMonthsFromNow.toISOString()}&pagination[limit]=1`,
        { timeout: TIMEOUT, ...HEADERS }
      );
      const futureVisitCount = futureVisitsResp.data.meta?.pagination?.total || 0;
      
      cabinetStats.push({
        id: cabinet.id,
        name,
        patients: patientCount,
        visits: visitCount,
        futureAppointments: futureVisitCount
      });
    }
    
    return cabinetStats;
  } catch (error) {
    log(`✗ Error getting cabinet statistics: ${error.message}`, 'red');
    return [];
  }
}

/**
 * Get user statistics
 */
async function getUserStatistics() {
  try {
    const response = await axios.get(`${STRAPI_URL}/api/users?pagination[limit]=1000`, {
      timeout: TIMEOUT,
      ...HEADERS
    });
    
    const users = response.data || [];
    
    // Count admins (have cabinet relation)
    const admins = users.filter(u => u.cabinet != null);
    
    // Count employees (have cabinet_angajat relation)
    const employees = users.filter(u => u.cabinet_angajat != null);
    
    return {
      total: users.length,
      admins: admins.length,
      employees: employees.length,
      other: users.length - admins.length - employees.length
    };
  } catch (error) {
    log(`✗ Error getting user statistics: ${error.message}`, 'red');
    return { total: 0, admins: 0, employees: 0, other: 0 };
  }
}

/**
 * Check if database is empty
 */
async function isDatabaseEmpty() {
  const cabinetCount = await getEntityCount('cabinets', 'Cabinets');
  const patientCount = await getEntityCount('pacients', 'Patients');
  const visitCount = await getEntityCount('vizitas', 'Visits');
  
  return cabinetCount === 0 && patientCount === 0 && visitCount === 0;
}

/**
 * Main verification function
 */
async function verifyDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           DATABASE VERIFICATION REPORT                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Check Strapi connection
    log('Checking Strapi connection...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
    const startTime = Date.now();
    
    // Get entity counts
    log('📊 Collecting statistics...\n', 'cyan');
    
    const cabinetCount = await getEntityCount('cabinets', 'Cabinets');
    const patientCount = await getEntityCount('pacients', 'Patients');
    const visitCount = await getEntityCount('vizitas', 'Visits');
    const planCount = await getEntityCount('plan-trataments', 'Treatment Plans');
    const priceCount = await getEntityCount('price-lists', 'Price Lists');
    const userStats = await getUserStatistics();
    
    // Display summary
    console.log('═══════════════════════════════════════════════════════════');
    log('  SUMMARY STATISTICS', 'bold');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    log(`  Cabinets:          ${cabinetCount.toLocaleString()}`, cabinetCount > 0 ? 'green' : 'yellow');
    log(`  Users (Total):     ${userStats.total.toLocaleString()}`, userStats.total > 0 ? 'green' : 'yellow');
    log(`    - Admins:        ${userStats.admins.toLocaleString()}`, userStats.admins > 0 ? 'green' : 'yellow');
    log(`    - Employees:     ${userStats.employees.toLocaleString()}`, userStats.employees > 0 ? 'green' : 'yellow');
    log(`  Patients:          ${patientCount.toLocaleString()}`, patientCount > 0 ? 'green' : 'yellow');
    log(`  Visits:            ${visitCount.toLocaleString()}`, visitCount > 0 ? 'green' : 'yellow');
    log(`  Treatment Plans:   ${planCount.toLocaleString()}`, planCount > 0 ? 'green' : 'yellow');
    log(`  Price Lists:       ${priceCount.toLocaleString()}`, priceCount > 0 ? 'green' : 'yellow');
    
    // Display cabinet details if any exist
    if (cabinetCount > 0) {
      console.log('\n═══════════════════════════════════════════════════════════');
      log('  CABINET DETAILS', 'bold');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      const cabinetStats = await getCabinetStatistics();
      
      for (const cabinet of cabinetStats) {
        log(`  ${cabinet.name}`, 'cyan');
        log(`    Patients:            ${cabinet.patients.toLocaleString()}`, 'blue');
        log(`    Total Visits:        ${cabinet.visits.toLocaleString()}`, 'blue');
        log(`    Future Appointments: ${cabinet.futureAppointments.toLocaleString()}`, 'magenta');
      }
    }
    
    // Expected values check (for production simulation)
    console.log('\n═══════════════════════════════════════════════════════════');
    log('  EXPECTED VALUES CHECK (10 cabinets, 10k patients each)', 'bold');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const expectedCabinets = 10;
    const expectedPatientsPerCabinet = 10000;
    const expectedTotalPatients = expectedCabinets * expectedPatientsPerCabinet;
    const expectedAdmins = 10;
    const expectedEmployees = 30;
    
    const checks = [
      { name: 'Cabinets', actual: cabinetCount, expected: expectedCabinets },
      { name: 'Admins', actual: userStats.admins, expected: expectedAdmins },
      { name: 'Employees', actual: userStats.employees, expected: expectedEmployees },
      { name: 'Total Patients', actual: patientCount, expected: expectedTotalPatients }
    ];
    
    let allChecksPassed = true;
    
    for (const check of checks) {
      const passed = check.actual === check.expected;
      const status = passed ? '✓' : '✗';
      const color = passed ? 'green' : 'red';
      const percentage = check.expected > 0 ? ((check.actual / check.expected) * 100).toFixed(1) : '0';
      
      log(`  ${status} ${check.name}: ${check.actual.toLocaleString()} / ${check.expected.toLocaleString()} (${percentage}%)`, color);
      
      if (!passed) allChecksPassed = false;
    }
    
    // Future appointments check
    if (cabinetCount > 0) {
      const cabinetStats = await getCabinetStatistics();
      const totalFutureAppointments = cabinetStats.reduce((sum, c) => sum + c.futureAppointments, 0);
      
      log(`  ${totalFutureAppointments > 0 ? '✓' : '✗'} Future Appointments (next 2 months): ${totalFutureAppointments.toLocaleString()}`, 
          totalFutureAppointments > 0 ? 'green' : 'red');
      
      if (totalFutureAppointments === 0) allChecksPassed = false;
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    if (allChecksPassed && cabinetCount === expectedCabinets) {
      log('  ✓ ALL CHECKS PASSED - Database is correctly populated!', 'green');
    } else if (cabinetCount === 0 && patientCount === 0) {
      log('  ℹ Database is EMPTY', 'yellow');
    } else {
      log('  ⚠ Some checks failed or database is partially populated', 'yellow');
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    
    log(`⏱  Verification time: ${elapsed}s\n`, 'cyan');
    
    // Return status for programmatic use
    return {
      isEmpty: cabinetCount === 0 && patientCount === 0 && visitCount === 0,
      allChecksPassed,
      counts: {
        cabinets: cabinetCount,
        patients: patientCount,
        visits: visitCount,
        plans: planCount,
        priceLists: priceCount,
        users: userStats
      }
    };
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('\n✗ Strapi is not running or not reachable.', 'red');
      log('  Please start the backend with: npm run develop\n', 'yellow');
    } else {
      log(`\n✗ Error: ${error.message}`, 'red');
    }
    process.exit(1);
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyDatabase().then((result) => {
    // Exit code 0: All checks passed (production data is valid)
    // Exit code 1: Database is empty OR checks failed (needs action)
    if (result.isEmpty) {
      process.exit(1); // Empty = needs data generation
    } else if (result.allChecksPassed) {
      process.exit(0); // All good!
    } else {
      process.exit(1); // Has data but checks failed
    }
  });
}

// Export for use in test-runner
module.exports = { verifyDatabase, isDatabaseEmpty };
