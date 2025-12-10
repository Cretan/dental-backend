/**
 * Quick Production Data Generator
 * Uses admin credentials instead of registration
 * 
 * Prerequisites: Strapi admin user must exist
 * Default: admin@admin.com / Admin123!
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');

const STRAPI_URL = 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const TIMEOUT = 30000;

// Test user credentials
const TEST_USER = {
  identifier: 'test@test.com',
  password: 'Test123!@#'
};
let JWT_TOKEN = null;

// Get auth config
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
  try {
    const response = await axios.post(`${STRAPI_URL}/api/auth/local`, TEST_USER, {
      timeout: TIMEOUT
    });
    
    if (response.data && response.data.jwt) {
      JWT_TOKEN = response.data.jwt;
      log('✓ Authentication successful', 'green');
      return true;
    }
    
    log('✗ No JWT token received', 'red');
    return false;
  } catch (error) {
    log(`✗ Authentication failed: ${error.message}`, 'red');
    return false;
  }
}

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

// Cabinet names
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
  { name: 'Diamond Dental', city: 'Oradea', street: 'Calea Victoriei', number: 15 }
];

const treatments = [
  { tip: 'Detartraj', minPret: 150, maxPret: 300 },
  { tip: 'Canal', minPret: 250, maxPret: 600 },
  { tip: 'Extractie', minPret: 100, maxPret: 400 },
  { tip: 'Plomba', minPret: 150, maxPret: 350 },
  { tip: 'Coronita', minPret: 500, maxPret: 1500 },
  { tip: 'Implant', minPret: 1500, maxPret: 4000 }
];

const allergies = ['Penicilină', 'Articaină', 'Latex', 'Fără alergii', null, null];
const medicalConditions = ['Diabet', 'Hipertensiune', 'Astm', 'Fără istoric', null, null];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Create cabinets
 */
async function createCabinets(count) {
  log('\n═══ Creating Cabinets ═══\n', 'cyan');
  
  const cabinets = [];
  
  for (let i = 0; i < count && i < cabinetNames.length; i++) {
    const info = cabinetNames[i];
    
    try {
      const response = await axios.post(`${API_BASE}/cabinets`, {
        data: {
          nume_cabinet: info.name,
          adresa: `${info.street} nr. ${info.number}, ${info.city}`,
          telefon: `+40${21 + i}${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `contact@${info.name.toLowerCase().replace(/\s+/g, '')}${i}.ro`,
          program_functionare: {
            luni: '8-20',
            marti: '8-20',
            miercuri: '8-20',
            joi: '8-20',
            vineri: '8-18'
          }
        }
      }, { ...getAuthConfig(), timeout: TIMEOUT });
      
      cabinets.push(response.data.data);
      log(`✓ ${info.name}`, 'green');
    } catch (error) {
      log(`✗ Failed: ${info.name}`, 'red');
    }
  }
  
  log(`\n✓ Created ${cabinets.length} cabinets\n`, 'green');
  return cabinets;
}

/**
 * Create price lists
 */
async function createPriceLists(cabinets) {
  log('\n═══ Creating Price Lists ═══\n', 'cyan');
  
  let total = 0;
  
  for (const cabinet of cabinets) {
    for (const treatment of treatments) {
      const price = Math.floor(Math.random() * (treatment.maxPret - treatment.minPret) + treatment.minPret);
      
      try {
        await axios.post(`${API_BASE}/price-lists`, {
          data: {
            tip_procedura: treatment.tip,
            pret_standard: price,
            cabinet: cabinet.id,
            activ: true
          }
        }, { ...getAuthConfig(), timeout: TIMEOUT });
        total++;
      } catch (error) {
        // Skip errors
      }
    }
    log(`✓ ${cabinet.attributes.nume_cabinet}: ${treatments.length} prices`, 'green');
  }
  
  log(`\n✓ Created ${total} price entries\n`, 'green');
}

/**
 * Create a patient
 */
async function createPatient(cabinet) {
  const gender = Math.random() > 0.5 ? 'M' : 'F';
  const name = generateRomanianName(gender);
  const birthYear = 1950 + Math.floor(Math.random() * 55);
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
  
  try {
    const response = await axios.post(`${API_BASE}/pacients`, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: cnp,
        data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
        telefon: phone,
        email: email,
        alergii: randomElement(allergies),
        istoric_medical: randomElement(medicalConditions),
        published_at: new Date().toISOString(),
        cabinet: cabinet.id
      }
    }, { ...getAuthConfig(), timeout: TIMEOUT });
    
    return response.data.data;
  } catch (error) {
    return null;
  }
}

/**
 * Create visits for patient
 */
async function createVisits(patient, cabinet) {
  const historicalCount = Math.floor(Math.random() * 11) + 5;
  const futureCount = Math.floor(Math.random() * 3) + 1;
  
  const patientStartYear = 2018 + Math.floor(Math.random() * 6);
  let currentDate = new Date(`${patientStartYear}-01-01`);
  currentDate.setMonth(Math.floor(Math.random() * 12));
  
  const now = new Date();
  let created = 0;
  
  // Historical visits
  for (let i = 0; i < historicalCount; i++) {
    const daysToAdd = i === 0 ? 0 : Math.floor(Math.random() * 60) + 14;
    currentDate = addDays(currentDate, daysToAdd);
    
    if (currentDate > now) {
      currentDate = addDays(now, -Math.floor(Math.random() * 30) - 1);
    }
    
    currentDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    try {
      await axios.post(`${API_BASE}/vizitas`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          data_programare: currentDate.toISOString(),
          tip_vizita: i === 0 ? 'VizitaInitiala' : 'Programare',
          status_vizita: 'Finalizata',
          durata: 60
        }
      }, { ...getAuthConfig(), timeout: TIMEOUT });
      created++;
    } catch (error) {
      // Skip conflicts
    }
  }
  
  // Future visits
  for (let i = 0; i < futureCount; i++) {
    const daysInFuture = Math.floor(Math.random() * 60) + 1;
    const futureDate = addDays(now, daysInFuture);
    futureDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    try {
      await axios.post(`${API_BASE}/vizitas`, {
        data: {
          pacient: patient.id,
          cabinet: cabinet.id,
          data_programare: futureDate.toISOString(),
          tip_vizita: 'Programare',
          status_vizita: 'Programata',
          durata: 60
        }
      }, { ...getAuthConfig(), timeout: TIMEOUT });
      created++;
    } catch (error) {
      // Skip conflicts
    }
  }
  
  return created;
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  // Default: 10,000 patients, 10 cabinets (as per requirements)
  const patientCount = parseInt(args[0]) || 10000;
  const cabinetCount = Math.min(parseInt(args[1]) || 10, 10);
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        QUICK PRODUCTION DATA GENERATOR                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  log('📊 Configuration:', 'bold');
  log(`   Cabinets: ${cabinetCount}`, 'blue');
  log(`   Patients per cabinet: ${Math.floor(patientCount / cabinetCount)}`, 'blue');
  log(`   Total patients: ${patientCount}`, 'blue');
  log(`   Estimated visits: ~${patientCount * 10}\n`, 'blue');
  
  try {
    // Check Strapi
    log('Checking Strapi...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
    // Authenticate
    log('Authenticating...', 'yellow');
    const authenticated = await loginAndGetToken();
    if (!authenticated) {
      throw new Error('Authentication failed');
    }
    
    const startTime = Date.now();
    
    // Create cabinets
    const cabinets = await createCabinets(cabinetCount);
    
    if (cabinets.length === 0) {
      log('✗ No cabinets created', 'red');
      process.exit(1);
    }
    
    // Create price lists
    await createPriceLists(cabinets);
    
    // Create patients and visits
    log('\n═══ Creating Patients & Visits ═══\n', 'cyan');
    
    let patientsCreated = 0;
    let visitsCreated = 0;
    const batchSize = 100;
    
    for (let i = 0; i < patientCount; i++) {
      const cabinet = cabinets[Math.floor(Math.random() * cabinets.length)];
      const patient = await createPatient(cabinet);
      
      if (patient) {
        patientsCreated++;
        const visits = await createVisits(patient, cabinet);
        visitsCreated += visits;
      }
      
      if ((i + 1) % batchSize === 0 || i === patientCount - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(1);
        log(`   Progress: ${i + 1}/${patientCount} patients | ${visitsCreated} visits (${rate}/sec, ${elapsed}s)`, 'blue');
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                  COMPLETE! 🎉                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    log('📊 Summary:', 'bold');
    log(`   ✓ ${cabinets.length} cabinets`, 'green');
    log(`   ✓ ${patientsCreated} patients`, 'green');
    log(`   ✓ ${visitsCreated} visits`, 'green');
    log(`   ⏱  Time: ${totalTime}s\n`, 'cyan');
    
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
