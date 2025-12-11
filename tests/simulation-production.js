/**
 * PRODUCTION-REALISTIC DATA SIMULATION
 * =====================================
 * Generates complete dental practice data:
 * - Users (super admin + employees per cabinet)
 * - Cabinets with user assignments
 * - Patients with complete profiles
 * - Treatment plans with prices
 * - Price lists per cabinet
 * - Visits spanning multiple years
 * 
 * ✨ NOW SUPPORTS INDEPENDENT EXECUTION ✨
 * Usage: node tests/simulation-production.js [patients] [cabinets]
 * Example: node tests/simulation-production.js 10000 10
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');
const StrapiLifecycle = require('./strapi-lifecycle');

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const AUTH_BASE = `${STRAPI_URL}/api/auth`;
const TIMEOUT = 30000;

// Test user credentials for JWT authentication
const TEST_USER = {
  identifier: 'test@test.com',
  password: 'Test123!@#'
};
let JWT_TOKEN = null;

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
 * Get auth config with JWT token
 */
function getAuthConfig() {
  return {
    timeout: TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`
    }
  };
}

/**
 * Login and get JWT token
 */
async function loginAndGetToken() {
  log('\n🔐 Authenticating test user...', 'cyan');
  
  // Wait a bit for Strapi to be fully ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const MAX_AUTH_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
    try {
      const response = await axios.post(`${STRAPI_URL}/api/auth/local`, TEST_USER, {
        timeout: TIMEOUT
      });
      
      if (response.data && response.data.jwt) {
        JWT_TOKEN = response.data.jwt;
        log(`✅ Authentication successful`, 'green');
        return true;
      }
      
      log(`❌ No JWT token received (attempt ${attempt}/${MAX_AUTH_RETRIES})`, 'yellow');
    } catch (error) {
      log(`❌ Authentication failed (attempt ${attempt}/${MAX_AUTH_RETRIES}): ${error.message}`, 'yellow');
      
      if (attempt < MAX_AUTH_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  log('❌ Authentication failed after all retries', 'red');
  return false;
}

/**
 * Check Strapi health before operations
 */
async function checkStrapiHealth() {
  const MAX_RETRIES = 5;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
      return true;
    } catch (error) {
      if (i < MAX_RETRIES - 1) {
        log(`⏳ Waiting for Strapi to be ready... (${i + 1}/${MAX_RETRIES})`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
}

/**
 * Count entities in database
 */
async function countEntities() {
  const counts = {
    visits: 0,
    plans: 0,
    prices: 0,
    patients: 0,
    cabinets: 0,
    users: 0,
    total: 0
  };
  
  try {
    const endpoints = [
      { key: 'visits', endpoint: 'vizitas' },
      { key: 'plans', endpoint: 'plan-trataments' },
      { key: 'prices', endpoint: 'price-lists' },
      { key: 'patients', endpoint: 'pacients' },
      { key: 'cabinets', endpoint: 'cabinets' },
      { key: 'users', endpoint: 'users' }
    ];
    
    for (const { key, endpoint } of endpoints) {
      const url = endpoint === 'users' ? `${STRAPI_URL}/api/${endpoint}` : `${API_BASE}/${endpoint}`;
      const response = await axios.get(`${url}?pagination[limit]=1`, getAuthConfig());
      const count = response.data.meta?.pagination?.total || 0;
      counts[key] = count;
      counts.total += count;
    }
  } catch (error) {
    log(`⚠ Error counting entities: ${error.message}`, 'yellow');
  }
  
  return counts;
}

/**
 * Display entity counts
 */
function displayCounts(counts, label) {
  log(`\n${label}:`, 'cyan');
  log(`  Cabinets: ${counts.cabinets}`, 'blue');
  log(`  Users: ${counts.users}`, 'blue');
  log(`  Patients: ${counts.patients}`, 'blue');
  log(`  Treatment Plans: ${counts.plans}`, 'blue');
  log(`  Price Lists: ${counts.prices}`, 'blue');
  log(`  Visits: ${counts.visits}`, 'blue');
  log(`  Total: ${counts.total}`, 'bold');
}

/**
 * Delete all entities of a specific type (used for cleanup)
 */
async function deleteAllEntities(endpoint, entityName) {
  try {
    let totalDeleted = 0;
    const batchSize = 100;
    
    while (true) {
      const response = await axios.get(`${API_BASE}/${endpoint}?pagination[page]=1&pagination[pageSize]=${batchSize}`, getAuthConfig());
      
      if (!response.data || !response.data.data) {
        break;
      }
      
      const entities = response.data.data;
      
      if (entities.length === 0) {
        break;
      }
      
      for (const entity of entities) {
        try {
          const entityId = entity.documentId || entity.id;
          await axios.delete(`${API_BASE}/${endpoint}/${entityId}`, getAuthConfig());
          totalDeleted++;
        } catch (error) {
          // Skip errors
        }
      }
      
      if (totalDeleted > 0 && totalDeleted % 50 === 0) {
        process.stdout.write(`\r     Deleted: ${totalDeleted} ${entityName}`);
      }
    }
    
    if (totalDeleted > 0) {
      console.log(`\r     ✓ Deleted ${totalDeleted} ${entityName}         `);
    }
    
    return totalDeleted;
  } catch (error) {
    log(`     ✗ Error deleting ${entityName}: ${error.message}`, 'red');
    return 0;
  }
}

// Romanian city data
const cities = ['București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea'];
const streets = ['Calea Victoriei', 'Bulevardul Unirii', 'Strada Republicii', 'Strada Mihai Eminescu', 'Bulevardul Independenței', 'Strada Avram Iancu', 'Bulevardul Carol I'];
const neighborhoods = ['Centru', 'Nord', 'Sud', 'Est', 'Vest'];

// Realistic cabinet names (no numbering, no "test")
const cabinetNames = [
  { name: 'Denta Smile', city: 'București', street: 'Calea Victoriei', number: 45 },
  { name: 'Premium Dental', city: 'Cluj-Napoca', street: 'Bulevardul Eroilor', number: 23 },
  { name: 'Alfa Dent', city: 'Timișoara', street: 'Strada Republicii', number: 67 },
  { name: 'Crystal Dental Clinic', city: 'Iași', street: 'Bulevardul Carol I', number: 12 },
  { name: 'Elite Dental', city: 'Constanța', street: 'Strada Mihai Eminescu', number: 89 },
  { name: 'Laser Dental', city: 'Craiova', street: 'Calea Unirii', number: 34 },
  { name: 'Nova Dent', city: 'Brașov', street: 'Strada Republicii', number: 56 },
  { name: 'Omega Dental', city: 'Galați', street: 'Bulevardul Independenței', number: 78 },
  { name: 'Bright Smile', city: 'Ploiești', street: 'Strada Avram Iancu', number: 91 },
  { name: 'Diamond Dental', city: 'Oradea', street: 'Calea Victoriei', number: 15 },
  { name: 'Royal Dent', city: 'București', street: 'Bulevardul Unirii', number: 102 },
  { name: 'Sunrise Dental', city: 'Cluj-Napoca', street: 'Strada Mihai Eminescu', number: 43 },
  { name: 'Aqua Dental', city: 'Timișoara', street: 'Bulevardul Independenței', number: 21 },
  { name: 'Phoenix Dent', city: 'Iași', street: 'Calea Victoriei', number: 76 },
  { name: 'Lux Dental Clinic', city: 'Constanța', street: 'Strada Republicii', number: 33 }
];

// Medical data
const allergies = [
  'Penicilină', 'Articaină', 'Latex', 'Iod', 'Aspirină', 'Amoxicilină',
  'Fără alergii cunoscute', null, null, null // 40% have allergies
];

const medicalConditions = [
  'Diabet zaharat tip 2', 'Hipertensiune arterială', 'Boli cardiovasculare',
  'Hepatită B/C vindecată', 'Tulburări de coagulare', 'Astm bronșic',
  'Fără istoric medical relevant', null, null, null // 40% have conditions
];

const treatments = [
  { tip: 'AditieOs', minPret: 100, maxPret: 300 },
  { tip: 'Canal', minPret: 250, maxPret: 600 },
  { tip: 'CoronitaAlbastra', minPret: 400, maxPret: 1000 },
  { tip: 'CoronitaGalbena', minPret: 450, maxPret: 1200 },
  { tip: 'CoronitaRoz', minPret: 500, maxPret: 1500 },
  { tip: 'Extractie', minPret: 100, maxPret: 400 },
  { tip: 'Implant', minPret: 1500, maxPret: 4000 },
  { tip: 'Punte', minPret: 1000, maxPret: 3000 }
];

/**
 * Utility: Random element from array
 */
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Utility: Add days to date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Step 1: Prepare User References (for display purposes only)
 * In production, real user accounts would be created through Strapi admin panel.
 * For this simulation, all entities are created by the authenticated test user,
 * and the added_by field is auto-populated by lifecycle hooks on the backend.
 */
async function createUsers(cabinetCount) {
  log('\n═══ Step 1: Preparing User References ═══\n', 'cyan');
  
  const users = [];
  
  // Create user reference data for each cabinet (1 admin + 3 employees)
  // These are for organizational purposes only - not actual user accounts
  for (let cabinetIdx = 0; cabinetIdx < cabinetCount; cabinetIdx++) {
    const cabinetUsers = [];
    
    // Super Admin reference for this cabinet
    const adminName = generateRomanianName();
    cabinetUsers.push({
      id: null, // Production: Would be real user ID from Strapi admin
      isAdmin: true,
      name: adminName.fullName,
      email: `admin.${adminName.firstName.toLowerCase()}.${cabinetIdx}@dentist.ro`
    });
    
    // 3 Employee references for this cabinet
    for (let empIdx = 0; empIdx < 3; empIdx++) {
      const empName = generateRomanianName();
      cabinetUsers.push({
        id: null, // Production: Would be real user ID from Strapi admin
        isAdmin: false,
        name: empName.fullName,
        email: `emp.${empName.firstName.toLowerCase()}.${cabinetIdx}.${empIdx}@dentist.ro`
      });
    }
    
    users.push(cabinetUsers);
    log(`✓ Cabinet ${cabinetIdx + 1}: 1 admin + 3 employees prepared`, 'green');
  }
  
  log(`\n✓ Prepared ${users.flat().length} user references (${cabinetCount} x 4)\n`, 'green');
  log(`ℹ️  Note: All entities created by authenticated test user`, 'cyan');
  log(`ℹ️  Production: added_by field auto-populated by backend lifecycle hooks`, 'cyan');
  return users;
}

/**
 * Step 2: Create Cabinets
 */
async function createCabinets(cabinetCount, usersByCabinet) {
  log('\n═══ Step 2: Creating Cabinets ═══\n', 'cyan');
  
  const cabinets = [];
  
  for (let i = 0; i < cabinetCount; i++) {
    const cabinetInfo = cabinetNames[i % cabinetNames.length];
    const cabinetUsers = usersByCabinet[i];
    const admin = cabinetUsers.find(u => u.isAdmin);
    const employees = cabinetUsers.filter(u => !u.isAdmin);
    
    // Add timestamp suffix to ensure uniqueness
    const timestamp = Date.now() + i;
    const uniqueSuffix = ` ${String.fromCharCode(65 + Math.floor(i / cabinetNames.length))}`;
    
    const cabinetData = {
      data: {
        nume_cabinet: `${cabinetInfo.name}${uniqueSuffix}`,
        adresa: `${cabinetInfo.street} nr. ${cabinetInfo.number}, ${cabinetInfo.city}`,
        telefon: `+40${21 + i}${Math.floor(timestamp % 100000000).toString().padStart(8, '0')}`,
        email: `contact${timestamp}@${cabinetInfo.name.toLowerCase().replace(/\s+/g, '')}.ro`,
        program_functionare: {
          luni: '8-20',
          marti: '8-20',
          miercuri: '8-20',
          joi: '8-20',
          vineri: '8-18',
          sambata: '9-14'
        }
      }
    };
    
    try {
      const response = await axios.post(`${API_BASE}/cabinets`, cabinetData, getAuthConfig());
      const cabinet = response.data.data;
      
      // Debug: log response structure
      if (!cabinet) {
        log(`   Response structure: ${JSON.stringify(response.data, null, 2)}`, 'gray');
        throw new Error('No cabinet data in response');
      }
      
      const cabinetId = cabinet.id || cabinet.documentId;
      
      // Handle both documented (with attributes) and v5 flat structure
      const cabinetRecord = {
        id: cabinetId,
        documentId: cabinet.documentId || cabinetId,
        attributes: cabinet.attributes || cabinet,
        nume_cabinet: cabinet.attributes?.nume_cabinet || cabinet.nume_cabinet,
        users: cabinetUsers
      };
      
      if (!cabinetRecord.nume_cabinet) {
        log(`   Cabinet structure: ${JSON.stringify(cabinet, null, 2)}`, 'gray');
        throw new Error('Invalid cabinet response structure - no nume_cabinet found');
      }
      
      cabinets.push(cabinetRecord);
      log(`✓ ${cabinetRecord.nume_cabinet} (${cabinetInfo.city}) - Admin: ${admin?.name}`, 'green');
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      log(`✗ Failed to create cabinet ${cabinetInfo.name}: ${errorMsg}`, 'red');
      if (error.response?.data) {
        log(`   Full error: ${JSON.stringify(error.response.data, null, 2)}`, 'gray');
      }
    }
  }
  
  log(`\n✓ Created ${cabinets.length} cabinets\n`, 'green');
  return cabinets;
}

/**
 * Step 3: Create Price Lists for each Cabinet
 */
async function createPriceLists(cabinets) {
  log('\n═══ Step 3: Creating Price Lists ═══\n', 'cyan');
  
  const priceLists = [];
  
  for (const cabinet of cabinets) {
    const cabinetPrices = [];
    
    for (const treatment of treatments) {
      const price = Math.floor(Math.random() * (treatment.maxPret - treatment.minPret) + treatment.minPret);
      
      try {
        const response = await axios.post(`${API_BASE}/price-lists`, {
          data: {
            tip_procedura: treatment.tip,
            pret_standard: price,
            cabinet: cabinet.id,
            descriere: `Preț standard pentru ${treatment.tip}`,
            activ: true
          }
        }, getAuthConfig());
        
        if (response.data?.data) {
          cabinetPrices.push(response.data.data);
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        log(`  ⚠ Failed to create price for ${treatment.tip}: ${errorMsg}`, 'yellow');
      }
    }
    
    priceLists.push(cabinetPrices);
    log(`✓ ${cabinet.nume_cabinet}: ${cabinetPrices.length} prices`, 'green');
  }
  
  log(`\n✓ Created ${priceLists.flat().length} price entries\n`, 'green');
  return priceLists;
}

/**
 * Step 4: Create Patients with Complete Profiles
 */
async function createPatient(cabinet, patientIndex) {
  const gender = Math.random() > 0.5 ? 'M' : 'F';
  const name = generateRomanianName(gender);
  const birthYear = 1950 + Math.floor(Math.random() * 55); // Age 20-75
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  // Use patientIndex as uniqueId to ensure unique CNP
  const cnp = generateValidCNP({
    year: birthYear,
    month: birthMonth,
    day: birthDay,
    gender: gender,
    uniqueId: patientIndex  // This ensures uniqueness across all patients
  });
  
  // Use patientIndex for unique phone and email
  const phone = `+407${String(patientIndex).padStart(8, '0')}`;
  const email = `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${patientIndex}@pacient.ro`;
  
  // Generate realistic address (70% have address)
  const hasAddress = Math.random() > 0.3;
  const address = hasAddress 
    ? `${randomElement(streets)} nr. ${Math.floor(Math.random() * 200) + 1}, ${randomElement(neighborhoods)}, ${randomElement(cities)}`
    : null;
  
  const patientData = {
    data: {
      nume: name.lastName,
      prenume: name.firstName,
      cnp: cnp,
      data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
      telefon: phone,
      email: email,
      adresa: address,
      istoric_medical: randomElement(medicalConditions),
      alergii: randomElement(allergies),
      publishedAt: new Date().toISOString(),
      cabinet: cabinet.id
    }
  };
  
  try {
    const response = await axios.post(`${API_BASE}/pacients`, patientData, getAuthConfig());
    return response.data.data;
  } catch (error) {
    // Log first few errors for debugging
    if (patientIndex < 5) {
      log(`   ⚠ Patient ${patientIndex} creation failed: ${error.response?.data?.error?.message || error.message}`, 'yellow');
    }
    return null;
  }
}

/**
 * Step 5: Create Treatment Plans for Patients
 */
async function createTreatmentPlans(patient, cabinet, priceList) {
  const plans = [];
  
  // Skip if no price list available
  if (!priceList || priceList.length === 0) {
    return plans;
  }
  
  // 60% of patients have treatment plans
  if (Math.random() > 0.4) {
    const treatmentCount = Math.floor(Math.random() * 5) + 1; // 1-5 treatments
    const tratamente = [];
    
    for (let i = 0; i < treatmentCount; i++) {
      const price = randomElement(priceList);
      
      // Safely extract price data
      const priceData = price.attributes || price;
      if (!priceData || !priceData.tip_procedura) {
        continue; // Skip invalid price entry
      }
      
      const tooth = `${Math.ceil(Math.random() * 4)}.${Math.ceil(Math.random() * 8)}`;
      
      tratamente.push({
        tip_procedura: priceData.tip_procedura,
        numar_dinte: tooth,
        pret: priceData.pret_standard || 100,
        status_tratament: randomElement(['Planificat', 'InCurs', 'Finalizat']),
        observatii: Math.random() > 0.7 ? `Observații pentru ${priceData.tip_procedura}` : null
      });
    }
    
    try {
      const response = await axios.post(`${API_BASE}/plan-trataments`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          tratamente: tratamente
        }
      }, getAuthConfig());
      
      plans.push(response.data.data);
    } catch (error) {
      // Skip errors
    }
  }
  
  return plans;
}

/**
 * Step 6: Create Visits for next 2 months (future appointments only)
 */
async function createVisits(patient, cabinet, currentYear) {
  const visits = [];
  
  // Each patient gets 0-3 appointments in the next 2 months
  const futureVisitCount = Math.floor(Math.random() * 4); // 0-3 visits
  
  if (futureVisitCount === 0) {
    return visits; // Some patients have no scheduled appointments
  }
  
  const now = new Date();
  const twoMonthsFromNow = addDays(now, 60);
  const treatmentTypes = treatments.map(t => t.tip);
  
  for (let i = 0; i < futureVisitCount; i++) {
    // Spread appointments across next 2 months
    const daysInFuture = Math.floor(Math.random() * 60) + 1; // 1-60 days from now
    const appointmentDate = addDays(now, daysInFuture);
    
    // Set working hours (9am-5pm)
    appointmentDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    let tipVizita = 'Programare';
    let observations = '';
    
    if (i === 0 && Math.random() < 0.2) {
      // 20% chance first visit is initial consultation
      tipVizita = 'VizitaInitiala';
      observations = 'Consult initial și evaluare.';
    } else {
      // Regular treatment appointment
      const treatment = randomElement(treatmentTypes);
      observations = `${treatment} - Programare viitoare`;
    }
    
    try {
      const response = await axios.post(`${API_BASE}/vizitas`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          data_programare: appointmentDate.toISOString(),
          tip_vizita: tipVizita,
          status_vizita: 'Programata',
          durata: 60,
          observatii: observations
        }
      }, getAuthConfig());
      
      visits.push(response.data.data);
    } catch (error) {
      // Skip conflicts or errors
    }
  }
  
  return visits;
}

/**
 * Main Execution
 */
async function main() {
  const args = process.argv.slice(2);
  const cabinetCount = parseInt(args[0]) || 10;  // Default: 10 cabinets
  const patientsPerCabinet = parseInt(args[1]) || 10000;  // Default: 10k patients per cabinet
  const patientCount = cabinetCount * patientsPerCabinet;  // Total patients
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     PRODUCTION-REALISTIC DENTAL PRACTICE SIMULATION       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  log('📊 Configuration:', 'bold');
  log(`   Cabinets: ${cabinetCount}`, 'blue');
  log(`   Patients per cabinet: ${patientsPerCabinet}`, 'blue');
  log(`   Total patients: ${patientCount.toLocaleString()}`, 'blue');
  log(`   Users per cabinet: 4 (1 admin + 3 employees)`, 'blue');
  log(`   Total users: ${cabinetCount * 4}`, 'blue');
  log(`   Visit timeline: Next 2 months (future appointments)`, 'blue');
  log(`   Treatment plans: ~60% of patients\n`, 'blue');
  
  try {
    // Check Strapi with retries
    log('🏥 Checking Strapi health...', 'yellow');
    let strapiReady = false;
    for (let i = 0; i < 5; i++) {
      try {
        // Try both health endpoints
        await axios.get(`${STRAPI_URL}/admin`, { timeout: 5000 });
        strapiReady = true;
        break;
      } catch (error) {
        if (i < 4) {
          log(`⏳ Waiting for Strapi... (${i + 1}/5)`, 'yellow');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
    
    if (!strapiReady) {
      log('❌ Strapi is not responding. Please start Strapi first.', 'red');
      process.exit(1);
    }
    log('✓ Strapi is running and healthy\n', 'green');
    
    // Authenticate
    log('🔐 Authenticating...', 'yellow');
    const authenticated = await loginAndGetToken();
    if (!authenticated) {
      throw new Error('Authentication failed');
    }
    
    // Count entities BEFORE population
    log('\n📊 Counting entities before population...', 'yellow');
    const beforeCounts = await countEntities();
    displayCounts(beforeCounts, '📋 Database state BEFORE population');
    
    // Check if database needs cleanup
    if (beforeCounts.total > 0) {
      log('\n⚠️  Database contains existing data!', 'yellow');
      log('   Running automatic cleanup...', 'cyan');
      
      // Import and run cleanup
      try {
        // Delete in correct order (same as cleanup-database.js)
        await deleteAllEntities('vizitas', 'visits');
        await deleteAllEntities('plan-trataments', 'treatment plans');
        await deleteAllEntities('price-lists', 'price lists');
        await deleteAllEntities('pacients', 'patients');
        await deleteAllEntities('cabinets', 'cabinets');
        
        // Verify cleanup
        const afterCleanup = await countEntities();
        if (afterCleanup.total === 0) {
          log('   ✓ Cleanup complete, database is empty\n', 'green');
        } else {
          log(`   ⚠ Warning: ${afterCleanup.total} entities still remain\n`, 'yellow');
        }
      } catch (error) {
        log(`   ✗ Cleanup failed: ${error.message}\n`, 'red');
        throw new Error('Cannot proceed with dirty database');
      }
    }
    
    const startTime = Date.now();
    
    // Step 1: Create Users
    const usersByCabinet = await createUsers(cabinetCount);
    
    // Step 2: Create Cabinets
    const cabinets = await createCabinets(cabinetCount, usersByCabinet);
    
    // Step 3: Create Price Lists
    const priceLists = await createPriceLists(cabinets);
    
    // Step 4-6: Create Patients, Plans, Visits
    log('\n═══ Step 4-6: Creating Patients, Plans & Visits ═══\n', 'cyan');
    
    let patientsCreated = 0;
    let plansCreated = 0;
    let visitsCreated = 0;
    const batchSize = 1000;
    const reportInterval = 1000;
    
    for (let i = 0; i < patientCount; i++) {
      const cabinet = cabinets[i % cabinets.length];  // Distribute evenly across cabinets
      const cabinetIdx = cabinets.indexOf(cabinet);
      
      const patient = await createPatient(cabinet, i);  // Pass index for uniqueness
      if (!patient) continue;
      
      patientsCreated++;
      
      // Create treatment plans (60% of patients)
      if (Math.random() < 0.6) {
        const plans = await createTreatmentPlans(patient, cabinet, priceLists[cabinetIdx]);
        plansCreated += plans.length;
      }
      
      // Create visits for next 2 months only
      const visits = await createVisits(patient, cabinet, new Date().getFullYear());
      visitsCreated += visits.length;
      
      // Progress reporting
      if ((i + 1) % reportInterval === 0 || i === patientCount - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(1);
        const patientsPerCabinet = Math.floor((i + 1) / cabinets.length);
        log(`   Progress: ${(i + 1).toLocaleString()}/${patientCount.toLocaleString()} patients (${patientsPerCabinet}/cabinet) | ${plansCreated} plans | ${visitsCreated} visits (${rate}/sec, ${elapsed}s)`, 'blue');
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Count entities AFTER population
    log('\n📊 Counting entities after population...', 'yellow');
    const afterCounts = await countEntities();
    displayCounts(afterCounts, '📋 Database state AFTER population');
    
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║              SIMULATION COMPLETE! 🎉                       ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝\n', 'green');
    
    log('📊 Summary:', 'bold');
    log(`   ✓ ${cabinets.length} cabinets`, 'green');
    log(`   ✓ ${usersByCabinet.flat().length} users (admins + employees)`, 'green');
    log(`   ✓ ${priceLists.flat().length} price list entries`, 'green');
    log(`   ✓ ${patientsCreated.toLocaleString()} patients with complete profiles`, 'green');
    log(`   ✓ ${plansCreated.toLocaleString()} treatment plans`, 'green');
    log(`   ✓ ${visitsCreated.toLocaleString()} visits (next 2 months)`, 'green');
    log(`   ⏱  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)\n`, 'cyan');
    
    log('📈 Database Growth:', 'bold');
    log(`   Visits: ${beforeCounts.visits} → ${afterCounts.visits} (+${afterCounts.visits - beforeCounts.visits})`, 'cyan');
    log(`   Plans: ${beforeCounts.plans} → ${afterCounts.plans} (+${afterCounts.plans - beforeCounts.plans})`, 'cyan');
    log(`   Prices: ${beforeCounts.prices} → ${afterCounts.prices} (+${afterCounts.prices - beforeCounts.prices})`, 'cyan');
    log(`   Patients: ${beforeCounts.patients} → ${afterCounts.patients} (+${afterCounts.patients - beforeCounts.patients})`, 'cyan');
    log(`   Cabinets: ${beforeCounts.cabinets} → ${afterCounts.cabinets} (+${afterCounts.cabinets - beforeCounts.cabinets})\n`, 'cyan');
    
    log('🌐 Access:', 'bold');
    log(`   Frontend: http://localhost:5173`, 'blue');
    log(`   Backend: http://localhost:1337/admin\n`, 'blue');
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    if (error.response?.data) {
      log(`  ${JSON.stringify(error.response.data)}`, 'red');
    }
    process.exit(1);
  }
}

(async () => {
  const lifecycle = new StrapiLifecycle();
  
  try {
    // Ensure Strapi is running
    await lifecycle.ensureStrapiRunning();
    
    // Run main simulation
    await main();
    
    // Cleanup Strapi lifecycle
    await lifecycle.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await lifecycle.cleanup();
    process.exit(1);
  }
})();
