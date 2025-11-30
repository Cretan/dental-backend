/**
 * Simulation Data Generator
 * Generates realistic patient data with visit history spanning multiple years
 * 
 * Usage: 
 *   node tests/simulation-data.test.js [patientCount] [cabinetCount]
 *   node tests/simulation-data.test.js 10000 10
 * 
 * Arguments:
 *   patientCount: Number of patients to generate (default: 1)
 *   cabinetCount: Number of dental cabinets to create (default: use existing or create 1)
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const TIMEOUT = 30000; // Increased timeout for large operations

// Colors
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Get a random date between start and end
 */
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Create a simulated patient with visits spanning multiple years
 */
async function createSimulatedPatient(cabinetIds, startYear = 2015) {
  try {
    // 1. Generate Patient Data
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const name = generateRomanianName(gender);
    const birthYear = 1950 + Math.floor(Math.random() * 55); // 1950-2005 (age 20-75)
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
    const email = `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${timestamp}@simulation.ro`;

    // 2. Create Patient
    log(`Creating patient: ${name.fullName} (${gender}, ${birthYear})`, 'blue');
    const patientResponse = await axios.post(`${API_BASE}/pacients`, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        CNP: cnp,
        data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
        telefon: phone,
        email: email
      }
    });
    
    const patientId = patientResponse.data.data.id;

    // 3. Generate Visits spanning multiple years (realistic: 5-15 visits over years)
    const visitCount = Math.floor(Math.random() * 11) + 5; // 5 to 15 visits
    const patientStartYear = startYear + Math.floor(Math.random() * 8); // Started treatment 0-8 years ago
    
    // Start date for visits (random year between startYear and now)
    let currentDate = new Date(`${patientStartYear}-01-01`);
    currentDate.setMonth(Math.floor(Math.random() * 12));
    currentDate.setDate(Math.floor(Math.random() * 28) + 1);

    const now = new Date();
    const treatments = ['Detartraj', 'Canal', 'Extractie', 'Plomba', 'Coronita', 'Implant', 'Punte'];
    
    for (let i = 1; i <= visitCount; i++) {
      let tipVizita = 'Programare';
      let statusVizita = 'Finalizata';
      let observations = '';

      // Determine visit type based on sequence
      if (i === 1) {
        tipVizita = 'VizitaInitiala';
        observations = 'Evaluare initiala, fisa pacientului.';
      } else if (i === 2) {
        tipVizita = 'PlanTratament';
        observations = 'Discutie plan tratament si costuri.';
      } else {
        tipVizita = 'Programare';
        const treatment = treatments[Math.floor(Math.random() * treatments.length)];
        observations = `${treatment} - Sedinta #${i-2}`;
      }

      // Advance date realistically (weeks/months apart, not days)
      const daysToAdd = i <= 3 
        ? Math.floor(Math.random() * 14) + 7  // First visits: 1-3 weeks apart
        : Math.floor(Math.random() * 90) + 30; // Later visits: 1-4 months apart
      
      currentDate = addDays(currentDate, daysToAdd);
      
      // Set time to working hours (9-17)
      currentDate.setHours(9 + Math.floor(Math.random() * 8), 0, 0, 0);

      // If date is in future, status is Programata
      if (currentDate > now) {
        statusVizita = 'Programata';
      }

      // Randomly assign to one of the cabinets
      const cabinetId = cabinetIds[Math.floor(Math.random() * cabinetIds.length)];

      // Create Visit
      try {
        await axios.post(`${API_BASE}/vizitas`, {
          data: {
            pacient: patientId,
            cabinet: cabinetId,
            data_programare: currentDate.toISOString(),
            tip_vizita: tipVizita,
            status_vizita: statusVizita,
            durata: 60,
            observatii: observations
          }
        }, { timeout: TIMEOUT });
      } catch (error) {
        // Skip conflicts, continue with next visit
        if (error.response?.status !== 400) {
          throw error;
        }
/**
 * Create multiple dental cabinets
 */
async function createCabinets(count) {
  const cabinetIds = [];
  const cities = ['București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați', 'Ploiești', 'Oradea'];
  const streets = ['Calea Victoriei', 'Bulevardul Unirii', 'Strada Republicii', 'Strada Mihai Eminescu', 'Bulevardul Independenței'];
  
  log(`Creating ${count} dental cabinets...`, 'blue');
  
  for (let i = 0; i < count; i++) {
    const city = cities[i % cities.length];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const cabinetNumber = i + 1;
    
    try {
      const newCabinet = await axios.post(`${API_BASE}/cabinets`, {
        data: {
          nume_cabinet: `Clinica Dentară ${city} #${cabinetNumber}`,
          adresa: `${street} nr. ${Math.floor(Math.random() * 200) + 1}, ${city}`,
          telefon: `+40${21 + i}${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `cabinet${cabinetNumber}.${city.toLowerCase().replace(/[^a-z]/g, '')}@dentist.ro`,
          program_functionare: { 
            luni: '8-20', 
            marti: '8-20', 
            miercuri: '8-20',
            joi: '8-20',
            vineri: '8-18',
            sambata: '9-14'
          }
        }
      }, { timeout: TIMEOUT });
      
      cabinetIds.push(newCabinet.data.data.id);
      log(`✓ Created: ${newCabinet.data.data.attributes.nume_cabinet}`, 'green');
    } catch (error) {
      log(`✗ Failed to create cabinet ${i + 1}: ${error.response?.data?.error?.message || error.message}`, 'red');
    }
  }
  
  return cabinetIds;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const patientCount = parseInt(args[0]) || 1;
  const cabinetCount = parseInt(args[1]) || 0;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       DENTAL PRACTICE SIMULATION - DATA GENERATOR         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  log(`📊 Configuration:`, 'blue');
  log(`   Patients: ${patientCount}`, 'blue');
  log(`   Cabinets: ${cabinetCount > 0 ? cabinetCount + ' (new)' : 'Use existing'}`, 'blue');
  log(`   Visits per patient: 5-15 (spanning multiple years)`, 'blue');
  log(`   Estimated total visits: ${patientCount * 10}`, 'blue');
  log(`   Start year: 2015 (simulating 10 years of practice)\n`, 'blue');

  try {
    // Check Strapi
    log('Checking Strapi connection...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
    // Get or Create Cabinets
    let cabinetIds = [];
    
    if (cabinetCount > 0) {
      cabinetIds = await createCabinets(cabinetCount);
      log(`\n✓ Created ${cabinetIds.length} cabinets\n`, 'green');
    } else {
      try {
        const cabinets = await axios.get(`${API_BASE}/cabinets`);
        if (cabinets.data.data.length > 0) {
          cabinetIds = cabinets.data.data.map(c => c.id);
          log(`Using ${cabinetIds.length} existing cabinet(s)\n`, 'blue');
        } else {
          log('No cabinets found, creating one...', 'yellow');
          cabinetIds = await createCabinets(1);
        }
      } catch (e) {
        log('Error getting cabinets, creating one...', 'yellow');
        cabinetIds = await createCabinets(1);
      }
    }

    if (cabinetIds.length === 0) {
      log('✗ No cabinets available. Cannot create patients.', 'red');
      process.exit(1);
    }

    // Create Patients
    log(`\n📝 Creating ${patientCount} patients with visit histories...`, 'blue');
    log(`   This may take a while for large datasets...\n`, 'yellow');
    
    const startTime = Date.now();
    const batchSize = 100; // Progress reporting every 100 patients
    
    for (let i = 0; i < patientCount; i++) {
      await createSimulatedPatient(cabinetIds, 2015);
      
      // Progress reporting
      if ((i + 1) % batchSize === 0 || i === patientCount - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(1);
        log(`   Progress: ${i + 1}/${patientCount} patients (${rate} patients/sec, ${elapsed}s elapsed)`, 'blue');
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgTime = (totalTime / patientCount * 1000).toFixed(0);
    
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║                  SIMULATION COMPLETE! 🎉                   ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝\n', 'green');
    
    log(`✓ Created ${patientCount} patients`, 'green');
    log(`✓ Estimated ${patientCount * 10} visits across ${cabinetIds.length} cabinet(s)`, 'green');
    log(`✓ Time span: 2015-2025 (10 years of practice data)`, 'green');
    log(`⏱  Total time: ${totalTime}s (avg ${avgTime}ms per patient)\n`, 'green');
    
    log(`🌐 View your data:`, 'blue');
    log(`   Frontend: http://localhost:5173`, 'blue');
    log(`   Backend Admin: http://localhost:1337/admin\n`, 'blue');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('\n✗ Strapi is not running or not reachable.', 'red');
      log('  Please start the backend with: npm run develop\n', 'yellow');
    } else {
      log(`\n✗ Error: ${error.message}`, 'red');
      if (error.response?.data) {
        log(`  Details: ${JSON.stringify(error.response.data)}`, 'red');
      }
    }
    process.exit(1);
  }
}

main();og('Error getting/creating cabinet', 'red');
      process.exit(1);
    }

    // Create Patients
    for (let i = 0; i < count; i++) {
      await createSimulatedPatient(cabinetId);
    }

    log('\nSimulation complete! 🎉', 'green');

  } catch (error) {
    log('Strapi is not running or not reachable.', 'red');
    log('Please start the backend with: npm run develop', 'yellow');
  }
}

main();
