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
 * Usage: node tests/simulation-production.js [patients] [cabinets]
 * Example: node tests/simulation-production.js 10000 10
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const AUTH_BASE = `${STRAPI_URL}/api/auth`;
const TIMEOUT = 30000;

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

// Romanian city data
const cities = ['București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea'];
const streets = ['Calea Victoriei', 'Bulevardul Unirii', 'Strada Republicii', 'Strada Mihai Eminescu', 'Bulevardul Independenței', 'Strada Avram Iancu', 'Bulevardul Carol I'];
const neighborhoods = ['Centru', 'Nord', 'Sud', 'Est', 'Vest'];

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
  { tip: 'Detartraj', minPret: 150, maxPret: 300 },
  { tip: 'Canal', minPret: 250, maxPret: 600 },
  { tip: 'Extractie', minPret: 100, maxPret: 400 },
  { tip: 'Plomba', minPret: 150, maxPret: 350 },
  { tip: 'Coronita', minPret: 500, maxPret: 1500 },
  { tip: 'Implant', minPret: 1500, maxPret: 4000 },
  { tip: 'Punte', minPret: 1000, maxPret: 3000 },
  { tip: 'Proteză', minPret: 800, maxPret: 5000 },
  { tip: 'Albire', minPret: 300, maxPret: 800 },
  { tip: 'Sigilare', minPret: 80, maxPret: 150 }
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
 * Step 1: Create Users (Admin + Employees)
 */
async function createUsers(cabinetCount) {
  log('\n═══ Step 1: Creating Users ═══\n', 'cyan');
  
  const users = [];
  
  // Get "Authenticated" role ID
  const rolesResponse = await axios.get(`${STRAPI_URL}/api/users-permissions/roles`);
  const authenticatedRole = rolesResponse.data.roles.find(r => r.name === 'Authenticated');
  
  if (!authenticatedRole) {
    throw new Error('Authenticated role not found');
  }
  
  const roleId = authenticatedRole.id;
  
  // Create 1 super admin + 3 employees per cabinet
  const totalUsers = cabinetCount * 4; // 1 admin + 3 employees
  
  for (let cabinetIdx = 0; cabinetIdx < cabinetCount; cabinetIdx++) {
    const cabinetUsers = [];
    
    // Super Admin for this cabinet
    const adminName = generateRomanianName();
    const adminUser = {
      username: `admin.${adminName.firstName.toLowerCase()}.${cabinetIdx}`,
      email: `admin.${adminName.firstName.toLowerCase()}.${cabinetIdx}@dentist.ro`,
      password: 'Admin123!',
      confirmed: true,
      blocked: false,
      role: roleId
    };
    
    try {
      const response = await axios.post(`${AUTH_BASE}/local/register`, adminUser, { timeout: TIMEOUT });
      cabinetUsers.push({ ...response.data.user, isAdmin: true, name: adminName.fullName });
      log(`✓ Admin: ${adminName.fullName} (${adminUser.email})`, 'green');
    } catch (error) {
      log(`✗ Failed to create admin: ${error.response?.data?.error?.message || error.message}`, 'red');
    }
    
    // 3 Employees for this cabinet
    for (let empIdx = 0; empIdx < 3; empIdx++) {
      const empName = generateRomanianName();
      const empUser = {
        username: `emp.${empName.firstName.toLowerCase()}.${cabinetIdx}.${empIdx}`,
        email: `emp.${empName.firstName.toLowerCase()}.${cabinetIdx}.${empIdx}@dentist.ro`,
        password: 'Employee123!',
        confirmed: true,
        blocked: false,
        role: roleId
      };
      
      try {
        const response = await axios.post(`${AUTH_BASE}/local/register`, empUser, { timeout: TIMEOUT });
        cabinetUsers.push({ ...response.data.user, isAdmin: false, name: empName.fullName });
      } catch (error) {
        // Skip duplicates or errors
      }
    }
    
    users.push(cabinetUsers);
  }
  
  log(`\n✓ Created ${users.flat().length} users (${cabinetCount} admins + employees)\n`, 'green');
  return users;
}

/**
 * Step 2: Create Cabinets with User Assignments
 */
async function createCabinets(cabinetCount, usersByCabinet) {
  log('\n═══ Step 2: Creating Cabinets ═══\n', 'cyan');
  
  const cabinets = [];
  
  for (let i = 0; i < cabinetCount; i++) {
    const city = cities[i % cities.length];
    const street = randomElement(streets);
    const number = Math.floor(Math.random() * 200) + 1;
    const cabinetUsers = usersByCabinet[i];
    const admin = cabinetUsers.find(u => u.isAdmin);
    const employees = cabinetUsers.filter(u => !u.isAdmin);
    
    const cabinetData = {
      data: {
        nume_cabinet: `Clinica Dentară ${city} #${i + 1}`,
        adresa: `${street} nr. ${number}, ${city}`,
        telefon: `+40${21 + i}${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `cabinet${i + 1}.${city.toLowerCase().replace(/[^a-z]/g, '')}@dentist.ro`,
        program_functionare: {
          luni: '8-20',
          marti: '8-20',
          miercuri: '8-20',
          joi: '8-20',
          vineri: '8-18',
          sambata: '9-14'
        },
        administrator_principal: admin ? admin.id : null,
        angajati: employees.map(e => e.id)
      }
    };
    
    try {
      const response = await axios.post(`${API_BASE}/cabinets`, cabinetData, { timeout: TIMEOUT });
      cabinets.push({
        ...response.data.data,
        users: cabinetUsers
      });
      log(`✓ ${cabinetData.data.nume_cabinet} - Admin: ${admin?.name || 'N/A'}, Employees: ${employees.length}`, 'green');
    } catch (error) {
      log(`✗ Failed to create cabinet: ${error.response?.data?.error?.message || error.message}`, 'red');
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
        }, { timeout: TIMEOUT });
        
        cabinetPrices.push(response.data.data);
      } catch (error) {
        // Skip errors
      }
    }
    
    priceLists.push(cabinetPrices);
    log(`✓ ${cabinet.attributes.nume_cabinet}: ${cabinetPrices.length} prices`, 'green');
  }
  
  log(`\n✓ Created ${priceLists.flat().length} price entries\n`, 'green');
  return priceLists;
}

/**
 * Step 4: Create Patients with Complete Profiles
 */
async function createPatient(cabinet) {
  const gender = Math.random() > 0.5 ? 'M' : 'F';
  const name = generateRomanianName(gender);
  const birthYear = 1950 + Math.floor(Math.random() * 55); // Age 20-75
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  const cnp = generateValidCNP({
    year: birthYear,
    month: birthMonth,
    day: birthDay,
    gender: gender,
    sequence: Math.floor(Math.random() * 900) + 100
  });
  
  const timestamp = Date.now().toString().slice(-6);
  const phone = `+407${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
  const email = `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${timestamp}@pacient.ro`;
  
  // Generate realistic address (70% have address)
  const hasAddress = Math.random() > 0.3;
  const address = hasAddress 
    ? `${randomElement(streets)} nr. ${Math.floor(Math.random() * 200) + 1}, ${randomElement(neighborhoods)}, ${randomElement(cities)}`
    : null;
  
  // Random employee who added this patient
  const addedBy = randomElement(cabinet.users);
  
  const patientData = {
    data: {
      nume: name.lastName,
      prenume: name.firstName,
      CNP: cnp,
      data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
      telefon: phone,
      email: email,
      adresa: address,
      istoric_medical: randomElement(medicalConditions),
      alergii: randomElement(allergies),
      cabinet: cabinet.id,
      added_by: addedBy.id
    }
  };
  
  try {
    const response = await axios.post(`${API_BASE}/pacients`, patientData, { timeout: TIMEOUT });
    return response.data.data;
  } catch (error) {
    // Skip duplicates
    return null;
  }
}

/**
 * Step 5: Create Treatment Plans for Patients
 */
async function createTreatmentPlans(patient, cabinet, priceList) {
  const plans = [];
  
  // 60% of patients have treatment plans
  if (Math.random() > 0.4) {
    const treatmentCount = Math.floor(Math.random() * 5) + 1; // 1-5 treatments
    const tratamente = [];
    
    for (let i = 0; i < treatmentCount; i++) {
      const price = randomElement(priceList);
      const tooth = `${Math.ceil(Math.random() * 4)}.${Math.ceil(Math.random() * 8)}`;
      
      tratamente.push({
        tip_procedura: price.attributes.tip_procedura,
        numar_dinte: tooth,
        pret: price.attributes.pret_standard,
        status_tratament: randomElement(['Planificat', 'InCurs', 'Finalizat']),
        observatii: Math.random() > 0.7 ? `Observații pentru ${price.attributes.tip_procedura}` : null
      });
    }
    
    const addedBy = randomElement(cabinet.users);
    
    try {
      const response = await axios.post(`${API_BASE}/plan-trataments`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          tratamente: tratamente,
          added_by: addedBy.id
        }
      }, { timeout: TIMEOUT });
      
      plans.push(response.data.data);
    } catch (error) {
      // Skip errors
    }
  }
  
  return plans;
}

/**
 * Step 6: Create Visits with Historical Timeline
 */
async function createVisits(patient, cabinet, startYear = 2015) {
  const visits = [];
  const visitCount = Math.floor(Math.random() * 11) + 5; // 5-15 visits
  const patientStartYear = startYear + Math.floor(Math.random() * 8); // Started 0-8 years ago
  
  let currentDate = new Date(`${patientStartYear}-01-01`);
  currentDate.setMonth(Math.floor(Math.random() * 12));
  currentDate.setDate(Math.floor(Math.random() * 28) + 1);
  
  const now = new Date();
  const treatmentTypes = treatments.map(t => t.tip);
  
  for (let i = 1; i <= visitCount; i++) {
    let tipVizita = 'Programare';
    let statusVizita = 'Finalizata';
    let observations = '';
    
    if (i === 1) {
      tipVizita = 'VizitaInitiala';
      observations = 'Evaluare initiala, fisa pacientului.';
    } else if (i === 2) {
      tipVizita = 'PlanTratament';
      observations = 'Discutie plan tratament si costuri.';
    } else {
      tipVizita = 'Programare';
      const treatment = randomElement(treatmentTypes);
      observations = `${treatment} - Sedinta #${i-2}`;
    }
    
    // Realistic spacing between visits
    const daysToAdd = i <= 3 
      ? Math.floor(Math.random() * 14) + 7  // First visits: 1-3 weeks
      : Math.floor(Math.random() * 90) + 30; // Later visits: 1-4 months
    
    currentDate = addDays(currentDate, daysToAdd);
    currentDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    if (currentDate > now) {
      statusVizita = 'Programata';
    }
    
    try {
      const response = await axios.post(`${API_BASE}/vizitas`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          data_programare: currentDate.toISOString(),
          tip_vizita: tipVizita,
          status_vizita: statusVizita,
          durata: 60,
          observatii: observations
        }
      }, { timeout: TIMEOUT });
      
      visits.push(response.data.data);
    } catch (error) {
      // Skip conflicts
    }
  }
  
  return visits;
}

/**
 * Main Execution
 */
async function main() {
  const args = process.argv.slice(2);
  const patientCount = parseInt(args[0]) || 100;
  const cabinetCount = parseInt(args[1]) || 2;
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     PRODUCTION-REALISTIC DENTAL PRACTICE SIMULATION       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  log('📊 Configuration:', 'bold');
  log(`   Cabinets: ${cabinetCount}`, 'blue');
  log(`   Users: ${cabinetCount * 4} (1 admin + 3 employees per cabinet)`, 'blue');
  log(`   Patients: ${patientCount}`, 'blue');
  log(`   Estimated visits: ${patientCount * 10}`, 'blue');
  log(`   Estimated treatment plans: ${Math.floor(patientCount * 0.6)}`, 'blue');
  log(`   Timeline: 2015-2025 (10 years)\n`, 'blue');
  
  try {
    // Check Strapi
    log('Checking Strapi...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
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
    const batchSize = 100;
    
    for (let i = 0; i < patientCount; i++) {
      const cabinet = cabinets[Math.floor(Math.random() * cabinets.length)];
      const cabinetIdx = cabinets.indexOf(cabinet);
      
      const patient = await createPatient(cabinet);
      if (!patient) continue;
      
      patientsCreated++;
      
      // Create treatment plans
      const plans = await createTreatmentPlans(patient, cabinet, priceLists[cabinetIdx]);
      plansCreated += plans.length;
      
      // Create visits
      const visits = await createVisits(patient, cabinet, 2015);
      visitsCreated += visits.length;
      
      // Progress reporting
      if ((i + 1) % batchSize === 0 || i === patientCount - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(1);
        log(`   Progress: ${i + 1}/${patientCount} patients | ${plansCreated} plans | ${visitsCreated} visits (${rate}/sec, ${elapsed}s)`, 'blue');
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║              SIMULATION COMPLETE! 🎉                       ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝\n', 'green');
    
    log('📊 Summary:', 'bold');
    log(`   ✓ ${cabinets.length} cabinets`, 'green');
    log(`   ✓ ${usersByCabinet.flat().length} users (admins + employees)`, 'green');
    log(`   ✓ ${priceLists.flat().length} price list entries`, 'green');
    log(`   ✓ ${patientsCreated} patients with complete profiles`, 'green');
    log(`   ✓ ${plansCreated} treatment plans`, 'green');
    log(`   ✓ ${visitsCreated} visits (2015-2025)`, 'green');
    log(`   ⏱  Time: ${totalTime}s\n`, 'cyan');
    
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

main();
