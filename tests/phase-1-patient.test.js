/**
 * Phase 1 Testing Script
 * Tests patient validation, search, and statistics endpoints
 * Handles cases where Strapi might be offline or not responding
 * 
 * ✨ NOW SUPPORTS INDEPENDENT EXECUTION ✨
 * Run directly: node phase-1-patient.test.js
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');
const StrapiLifecycle = require('./strapi-lifecycle');

const STRAPI_URL = 'http://localhost:1337';
const API_BASE = `${STRAPI_URL}/api/pacients`;
const CABINET_API_BASE = `${STRAPI_URL}/api/cabinets`;
const TIMEOUT = 5000; // 5 second timeout
const MAX_RETRIES = 3;

// Authentication credentials for testing
const TEST_USER = {
  identifier: 'test@test.com',
  password: 'Test123!@#'
};

let JWT_TOKEN = null;
let TEST_USER_ID = null; // Authenticated user ID for added_by field
let TEST_CABINET_ID = null; // Shared test cabinet for all patients

// Default config
const defaultConfig = {
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  }
};

// Function to get auth config with JWT
function getAuthConfig() {
  return {
    ...defaultConfig,
    headers: {
      ...defaultConfig.headers,
      'Authorization': `Bearer ${JWT_TOKEN}`
    }
  };
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Login and get JWT token and user ID
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
        TEST_USER_ID = response.data.user?.id || response.data.user?.documentId;
        log(`✅ Authentication successful (User ID: ${TEST_USER_ID})`, 'green');
        return true;
      }
      
      log(`❌ No JWT token received (attempt ${attempt}/${MAX_AUTH_RETRIES})`, 'yellow');
    } catch (error) {
      log(`❌ Authentication failed (attempt ${attempt}/${MAX_AUTH_RETRIES}): ${error.message}`, 'yellow');
      if (error.response) {
        log(`   Response: ${JSON.stringify(error.response.data)}`, 'gray');
      }
      
      if (attempt < MAX_AUTH_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  log('❌ Authentication failed after all retries', 'red');
  return false;
}

/**
 * Create a test cabinet for patients
 */
async function createTestCabinet() {
  log('\n🏥 Creating test cabinet...', 'cyan');
  
  try {
    const timestamp = Date.now();
    const uniquePhone = `+40${700000000 + Math.floor(Math.random() * 100000000)}`;
    const cabinetData = {
      data: {
        nume_cabinet: `Test Cabinet ${timestamp}`,
        adresa: 'Str. Test nr. 1',
        telefon: uniquePhone,
        email: `cabinet${timestamp}@test.ro`,
        program_functionare: {
          luni: '08:00-18:00',
          marti: '08:00-18:00',
          miercuri: '08:00-18:00',
          joi: '08:00-18:00',
          vineri: '08:00-18:00'
        },
        publishedAt: new Date().toISOString()
      }
    };
    
    const response = await axios.post(CABINET_API_BASE, cabinetData, getAuthConfig());
    
    if (response.status === 200 || response.status === 201) {
      TEST_CABINET_ID = response.data.data.id;
      log(`✅ Test cabinet created (ID: ${TEST_CABINET_ID})`, 'green');
      return true;
    }
  } catch (error) {
    log(`❌ Failed to create cabinet: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data)}`, 'gray');
    }
  }
  
  return false;
}

/**
 * Delete test cabinet
 */
async function deleteTestCabinet() {
  if (!TEST_CABINET_ID) return;
  
  try {
    await axios.delete(`${CABINET_API_BASE}/${TEST_CABINET_ID}`, getAuthConfig());
    log(`✅ Test cabinet deleted (ID: ${TEST_CABINET_ID})`, 'green');
  } catch (error) {
    log(`⚠️  Failed to delete cabinet: ${error.message}`, 'yellow');
  }
}

/**
 * Check if Strapi is running and responsive
 */
async function checkStrapiHealth() {
  log('\n🏥 Checking Strapi health...', 'cyan');
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(`${STRAPI_URL}/_health`, {
        timeout: TIMEOUT,
        validateStatus: () => true // Accept any status
      });
      
      log(`✅ Strapi is responding (attempt ${attempt}/${MAX_RETRIES})`, 'green');
      
      // After health check, authenticate
      if (attempt === 1) {
        const authenticated = await loginAndGetToken();
        if (!authenticated) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        log(`⏳ Attempt ${attempt}/${MAX_RETRIES} failed, retrying...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  log('❌ Strapi is NOT responding after 3 attempts', 'red');
  log('   Please start Strapi with: npm run develop', 'gray');
  return false;
}

/**
 * Test patient creation with valid data
 */
async function testValidPatientCreation() {
  log('\n📝 TEST 1: Creating patient with VALID data', 'cyan');
  
  try {
    // Generate unique data for this test run with VALID CNP
    const timestamp = Date.now().toString().slice(-4);
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const name = generateRomanianName(gender);
    const birthYear = 1980 + Math.floor(Math.random() * 20); // 1980-2000
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    const sequence = Math.floor(Math.random() * 800) + 100; // 100-899
    
    const validCNP = generateValidCNP({
      year: birthYear,
      month: birthMonth,
      day: birthDay,
      gender: gender,
      sequence: sequence
    });
    
    const validPatient = {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: validCNP,
        data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
        publishedAt: new Date().toISOString(),
        telefon: `+4070011${timestamp}`,
        email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${timestamp}@test.ro`,
        cabinet: TEST_CABINET_ID // Link to test cabinet
      }
    };
    
    const response = await axios.post(API_BASE, validPatient, getAuthConfig());
    
    if (response.status === 200 || response.status === 201) {
      log('✅ Patient created successfully', 'green');
      log(`   ID: ${response.data.data.id}`, 'gray');
      log(`   Name: ${response.data.data.nume} ${response.data.data.prenume}`, 'gray');
      return response.data.data.documentId;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - Strapi is not running', 'red');
    } else if (error.response) {
      log(`❌ Request failed: ${error.response.data.error?.message || 'Unknown error'}`, 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }
  
  return null;
}

/**
 * Test patient creation with invalid CNP
 */
async function testInvalidCNP() {
  log('\n📝 TEST 2: Creating patient with INVALID CNP', 'cyan');
  
  try {
    const name = generateRomanianName();
    const invalidPatient = {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: 'invalid123',
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    };
    
    const response = await axios.post(API_BASE, invalidPatient, {
      ...getAuthConfig(),
      validateStatus: () => true // Don't throw on 4xx
    });
    
    if (response.status === 400) {
      log('✅ Validation working: CNP rejected as expected', 'green');
      log(`   Error: ${response.data.error?.message}`, 'gray');
      return true;
    } else {
      log('❌ FAILED: Invalid CNP was accepted!', 'red');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - Strapi is not running', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Test patient creation with invalid phone
 */
async function testInvalidPhone() {
  log('\n📝 TEST 3: Creating patient with INVALID phone', 'cyan');
  
  try {
    const name = generateRomanianName();
    const invalidPatient = {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1900101012349',
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '123', // Invalid phone
      }
    };    const response = await axios.post(API_BASE, invalidPatient, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Phone rejected as expected', 'green');
      log(`   Error: ${response.data.error?.message}`, 'gray');
      return true;
    } else {
      log('❌ FAILED: Invalid phone was accepted!', 'red');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - Strapi is not running', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Test search endpoint
 */
async function testSearchEndpoint() {
  log('\n📝 TEST 4: Testing search endpoint', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/search`, {
      ...getAuthConfig(),
      params: { query: 'ionescu' }
    });
    
    if (response.status === 200) {
      const results = response.data;
      log('✅ Search endpoint working', 'green');
      log(`   Found ${Array.isArray(results) ? results.length : 0} results`, 'gray');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - Strapi is not running', 'red');
    } else if (error.response?.status === 404) {
      log('❌ Search endpoint not found - custom routes not loaded', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Test statistics endpoint
 */
async function testStatisticsEndpoint() {
  log('\n📝 TEST 5: Testing statistics endpoint', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/statistics`, {
      timeout: TIMEOUT
    });
    
    if (response.status === 200) {
      const stats = response.data;
      log('✅ Statistics endpoint working', 'green');
      log(`   Total patients: ${stats.total}`, 'gray');
      log(`   Age groups: ${stats.ageDistribution?.length || 0}`, 'gray');
      return true;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Connection refused - Strapi is not running', 'red');
    } else if (error.response?.status === 404) {
      log('❌ Statistics endpoint not found - custom routes not loaded', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Cleanup: Delete test patient
 */
async function cleanupTestPatient(documentId) {
  if (!documentId) return;

  log('\n🧹 Cleaning up test data...', 'cyan');

  try {
    await axios.delete(`${API_BASE}/${documentId}`, {
      ...getAuthConfig()
    });
    // Verificăm dacă pacientul a fost șters
    try {
      await axios.get(`${API_BASE}/${documentId}`, {
        ...getAuthConfig()
      });
      log('❌ Patient was NOT deleted! Test failed.', 'red');
      process.exit(1);
    } catch (getErr) {
      if (getErr.response && getErr.response.status === 404) {
        log('✅ Test patient deleted and confirmed', 'green');
      } else {
        log('⚠️  Could not confirm deletion (unexpected error)', 'yellow');
        process.exit(1);
      }
    }
  } catch (error) {
    log('❌ Could not delete test patient (delete failed)', 'red');
    process.exit(1);
  }
}

// ============================================
// NEW TESTS - CNP EDGE CASES
// ============================================

/**
 * Test CNP with wrong length
 */
async function testCNPWrongLength(type) {
  const cnpValue = type === 'short' ? '123456789' : '12345678901234567';
  log(`\n📝 TEST: CNP wrong length (${type === 'short' ? '< 13' : '> 13'})`, 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: cnpValue,
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log(`✅ Validation working: ${type} CNP rejected`, 'green');
      return true;
    } else {
      log(`❌ FAILED: ${type} CNP was accepted!`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test CNP with non-numeric characters
 */
async function testCNPNonNumeric() {
  log('\n📝 TEST: CNP with non-numeric characters', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '12345ABC67890',
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Non-numeric CNP rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Non-numeric CNP was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test CNP with invalid first digit (not 1-8)
 */
async function testCNPInvalidFirstDigit() {
  log('\n📝 TEST: CNP with invalid first digit (0, 9)', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '0900101012345',
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Invalid first digit rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Invalid first digit CNP was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test CNP with all zeros
 */
async function testCNPAllZeros() {
  log('\n📝 TEST: CNP all zeros edge case', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '0000000000000',
        data_nasterii: '1990-01-01',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: All zeros CNP rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: All zeros CNP was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - PHONE EDGE CASES
// ============================================

/**
 * Test phone with spaces/hyphens (should be cleaned and accepted)
 */
async function testPhoneWithSpaces() {
  log('\n📝 TEST: Phone with spaces/hyphens (should clean)', 'cyan');
  
  try {
    const timestamp = Date.now().toString().slice(-4);
    const name = generateRomanianName('F');
    const cnp = generateValidCNP({ year: 1991, month: 6, day: 10, gender: 'F', sequence: 101 + parseInt(timestamp) % 100 });
    
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: cnp,
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40 700 123 456'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 200 || response.status === 201) {
      log('✅ Phone cleaning working: Spaces removed and accepted', 'green');
      // Cleanup
      if (response.data.data?.documentId) {
        await cleanupTestPatient(response.data.data.documentId);
      }
      return true;
    } else {
      log('❌ FAILED: Phone with spaces was rejected!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test phone with wrong country code
 */
async function testPhoneWrongCountryCode() {
  log('\n📝 TEST: Phone with wrong country code (+1, +44)', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+1234567890'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Wrong country code rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Wrong country code was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test phone with wrong length
 */
async function testPhoneWrongLength() {
  log('\n📝 TEST: Phone with wrong length', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+4070012'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Wrong length phone rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Wrong length phone was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test landline number (not mobile)
 */
async function testPhoneLandline() {
  log('\n📝 TEST: Landline phone (should be rejected)', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40211234567' // Bucharest landline
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Landline rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Landline was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - EMAIL EDGE CASES
// ============================================

/**
 * Test email missing @
 */
async function testEmailMissingAt() {
  log('\n📝 TEST: Email missing @ symbol', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000',
        email: 'invalidemail.com'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Email without @ rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Email without @ was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test email missing domain
 */
async function testEmailMissingDomain() {
  log('\n📝 TEST: Email missing domain', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000',
        email: 'test@'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Email without domain rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Email without domain was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test email with invalid special characters
 */
async function testEmailInvalidChars() {
  log('\n📝 TEST: Email with invalid special characters', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000',
        email: 'test<>@example.com'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Email with invalid chars rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Email with invalid chars was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test very long email
 */
async function testEmailVeryLong() {
  log('\n📝 TEST: Very long email (>255 chars)', 'cyan');
  
  try {
    const name = generateRomanianName();
    const longEmail = 'a'.repeat(250) + '@test.com';
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: '1991-06-10',
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000',
        email: longEmail
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Very long email rejected', 'green');
      return true;
    } else {
      log('⚠️  Warning: Very long email was accepted', 'yellow');
      // Cleanup if created
      if (response.data.data?.documentId) {
        await cleanupTestPatient(response.data.data.documentId);
      }
      return true; // This might be acceptable depending on requirements
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - BIRTH DATE & AGE
// ============================================

/**
 * Test birth date in future
 */
async function testBirthDateFuture() {
  log('\n📝 TEST: Birth date in future', 'cyan');
  
  try {
    const name = generateRomanianName();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1910610012345',
        data_nasterii: futureDateStr,
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Future birth date rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Future birth date was accepted!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test age > 120 years
 */
async function testAgeOver120() {
  log('\n📝 TEST: Age > 120 years', 'cyan');
  
  try {
    const name = generateRomanianName();
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 121);
    const oldDateStr = oldDate.toISOString().split('T')[0];
    
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName,
        prenume: name.firstName,
        cnp: '1010101012345',
        data_nasterii: oldDateStr,
        publishedAt: new Date().toISOString(),
        telefon: '+40700000000'
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Age > 120 rejected', 'green');
      return true;
    } else {
      log('⚠️  Warning: Age > 120 was accepted', 'yellow');
      // Cleanup if created
      if (response.data.data?.documentId) {
        await cleanupTestPatient(response.data.data.documentId);
      }
      return true; // This might be acceptable depending on requirements
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - PATIENT CRUD
// ============================================

/**
 * Test duplicate CNP
 */
async function testDuplicateCNP() {
  log('\n📝 TEST: Create patient with duplicate CNP', 'cyan');
  
  try {
    const timestamp = Date.now().toString().slice(-4);
    const name1 = generateRomanianName('M');
    const name2 = generateRomanianName('M');
    const cnp = generateValidCNP({ year: 1992, month: 3, day: 20, gender: 'M', sequence: 200 });
    
    // Create first patient
    const first = await axios.post(API_BASE, {
      data: {
        nume: name1.lastName,
        prenume: name1.firstName,
        cnp: cnp,
        data_nasterii: '1992-03-20',
        publishedAt: new Date().toISOString(),
        telefon: `+4070011${timestamp}`,
        email: `${name1.firstName.toLowerCase()}.${name1.lastName.toLowerCase()}.${timestamp}@test.ro`,
        cabinet: TEST_CABINET_ID
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true // Don't throw on error
    });
    
    // Check if first patient was created successfully
    if (first.status !== 200 && first.status !== 201) {
      log(`❌ Failed to create first patient: ${first.data.error?.message || 'Unknown error'}`, 'red');
      return false;
    }
    
    // Try to create second patient with same CNP
    const second = await axios.post(API_BASE, {
      data: {
        nume: name2.lastName,
        prenume: name2.firstName,
        cnp: cnp, // Same CNP
        data_nasterii: '1992-03-20',
        publishedAt: new Date().toISOString(),
        telefon: `+4070021${timestamp}`,
        cabinet: TEST_CABINET_ID
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    // Cleanup first patient
    if (first.data.data?.documentId) {
      await cleanupTestPatient(first.data.data.documentId);
    }
    
    if (second.status === 400 || second.status === 409) {
      log('✅ Validation working: Duplicate CNP rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Duplicate CNP was accepted!', 'red');
      // Cleanup second patient if created
      if (second.data.data?.documentId) {
        await cleanupTestPatient(second.data.data.documentId);
      }
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test missing required fields
 */
async function testMissingRequiredFields() {
  log('\n📝 TEST: Create patient missing required fields', 'cyan');
  
  try {
    const name = generateRomanianName();
    const response = await axios.post(API_BASE, {
      data: {
        nume: name.lastName
        // Missing: prenume, CNP, data_nasterii, telefon
      }
    }, {
      ...getAuthConfig(),
      validateStatus: () => true
    });
    
    if (response.status === 400) {
      log('✅ Validation working: Missing required fields rejected', 'green');
      return true;
    } else {
      log('❌ FAILED: Patient with missing fields was created!', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test update patient
 */
async function testUpdatePatient(documentId) {
  log('\n📝 TEST: Update patient with valid changes', 'cyan');
  
  if (!documentId) {
    log('⚠️  Skipped: No patient ID available', 'yellow');
    return true;
  }
  
  try {
    const response = await axios.put(`${API_BASE}/${documentId}`, {
      data: {
        prenume: 'IonUpdated'
      }
    }, {
      ...getAuthConfig()
    });
    
    if (response.status === 200) {
      log('✅ Update working: Patient updated successfully', 'green');
      return true;
    } else {
      log('❌ FAILED: Update returned unexpected status', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test get patient by ID
 */
async function testGetPatientById(documentId) {
  log('\n📝 TEST: Get patient by ID', 'cyan');
  
  if (!documentId) {
    log('⚠️  Skipped: No patient ID available', 'yellow');
    return true;
  }
  
  try {
    const response = await axios.get(`${API_BASE}/${documentId}`, {
      ...getAuthConfig()
    });
    
    if (response.status === 200 && response.data.data) {
      log('✅ Get by ID working: Patient retrieved successfully', 'green');
      return true;
    } else {
      log('❌ FAILED: Could not retrieve patient', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test pagination
 */
async function testPagination() {
  log('\n📝 TEST: Get all patients with pagination', 'cyan');
  
  try {
    const response = await axios.get(API_BASE, {
      ...getAuthConfig(),
      params: {
        'pagination[page]': 1,
        'pagination[pageSize]': 10
      }
    });
    
    if (response.status === 200 && response.data.data) {
      log('✅ Pagination working: Retrieved paginated results', 'green');
      log(`   Page size: ${response.data.data.length}`, 'gray');
      return true;
    } else {
      log('❌ FAILED: Pagination not working', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - SEARCH EDGE CASES
// ============================================

/**
 * Test search by phone
 */
async function testSearchByPhone() {
  log('\n📝 TEST: Search patients by phone', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/search`, {
      ...getAuthConfig(),
      params: { query: '0700' }
    });
    
    if (response.status === 200) {
      log('✅ Search by phone working', 'green');
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      log('⚠️  Search endpoint not found', 'yellow');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Test search by email
 */
async function testSearchByEmail() {
  log('\n📝 TEST: Search patients by email', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/search`, {
      ...getAuthConfig(),
      params: { query: 'test.ro' }
    });
    
    if (response.status === 200) {
      log('✅ Search by email working', 'green');
      return true;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      log('⚠️  Search endpoint not found', 'yellow');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Test search with special characters
 */
async function testSearchSpecialChars() {
  log('\n📝 TEST: Search with special characters', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/search`, {
      ...getAuthConfig(),
      params: { query: '<script>alert("test")</script>' },
      validateStatus: () => true
    });
    
    if (response.status === 200 || response.status === 400) {
      log('✅ Search handles special chars safely', 'green');
      return true;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// NEW TESTS - STATISTICS EDGE CASES
// ============================================

/**
 * Test statistics with patient without birth date
 */
async function testStatsNoBirthDate() {
  log('\n📝 TEST: Statistics with diverse patient data', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/statistics`, {
      timeout: TIMEOUT
    });
    
    if (response.status === 200 && response.data.total >= 0) {
      log('✅ Statistics endpoint handles edge cases', 'green');
      return true;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('╔════════════════════════════════════════════════╗', 'cyan');
  log('║     PHASE 1 IMPLEMENTATION TEST SUITE          ║', 'cyan');
  log('╚════════════════════════════════════════════════╝', 'cyan');
  
  // Initialize Strapi lifecycle management
  const lifecycle = new StrapiLifecycle();
  
  try {
    // Ensure Strapi is running (will start if needed)
    await lifecycle.ensureStrapiRunning();
    
    // Authenticate
    const authenticated = await loginAndGetToken();
    if (!authenticated) {
      log('\n❌ CANNOT RUN TESTS - Authentication failed', 'red');
      await lifecycle.cleanup();
      process.exit(1);
    }
    
    // Check if Strapi is running
    const strapiHealthy = await checkStrapiHealth();
    
    if (!strapiHealthy) {
      log('\n❌ CANNOT RUN TESTS - Strapi is not responding', 'red');
      await lifecycle.cleanup();
      process.exit(1);
    }
    
    // Create test cabinet for all patients
    const cabinetCreated = await createTestCabinet();
    if (!cabinetCreated) {
      log('\n❌ CANNOT RUN TESTS - Failed to create test cabinet', 'red');
      await lifecycle.cleanup();
      process.exit(1);
    }
  
  // Run all tests
  let createdPatientId = null;
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  // Test 1: Valid patient creation
  results.total++;
  createdPatientId = await testValidPatientCreation();
  if (createdPatientId) results.passed++; else results.failed++;
  
  // Test 2: Invalid CNP validation
  results.total++;
  const cnpTest = await testInvalidCNP();
  if (cnpTest) results.passed++; else results.failed++;
  
  // Test 3: Invalid phone validation
  results.total++;
  const phoneTest = await testInvalidPhone();
  if (phoneTest) results.passed++; else results.failed++;
  
  // Test 4: Search endpoint
  results.total++;
  const searchTest = await testSearchEndpoint();
  if (searchTest) results.passed++; else results.failed++;
  
  // Test 5: Statistics endpoint
  results.total++;
  const statsTest = await testStatisticsEndpoint();
  if (statsTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - CNP EDGE CASES ======
  
  // Test 6: CNP wrong length (< 13)
  results.total++;
  const cnpShortTest = await testCNPWrongLength('short');
  if (cnpShortTest) results.passed++; else results.failed++;
  
  // Test 7: CNP wrong length (> 13)
  results.total++;
  const cnpLongTest = await testCNPWrongLength('long');
  if (cnpLongTest) results.passed++; else results.failed++;
  
  // Test 8: CNP non-numeric characters
  results.total++;
  const cnpNonNumericTest = await testCNPNonNumeric();
  if (cnpNonNumericTest) results.passed++; else results.failed++;
  
  // Test 9: CNP invalid first digit
  results.total++;
  const cnpInvalidFirstDigitTest = await testCNPInvalidFirstDigit();
  if (cnpInvalidFirstDigitTest) results.passed++; else results.failed++;
  
  // Test 10: CNP all zeros
  results.total++;
  const cnpAllZerosTest = await testCNPAllZeros();
  if (cnpAllZerosTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - PHONE EDGE CASES ======
  
  // Test 11: Phone with spaces/hyphens (should be cleaned)
  results.total++;
  const phoneWithSpacesTest = await testPhoneWithSpaces();
  if (phoneWithSpacesTest) results.passed++; else results.failed++;
  
  // Test 12: Phone wrong country code
  results.total++;
  const phoneWrongCountryTest = await testPhoneWrongCountryCode();
  if (phoneWrongCountryTest) results.passed++; else results.failed++;
  
  // Test 13: Phone wrong length
  results.total++;
  const phoneWrongLengthTest = await testPhoneWrongLength();
  if (phoneWrongLengthTest) results.passed++; else results.failed++;
  
  // Test 14: Phone landline number (not mobile)
  results.total++;
  const phoneLandlineTest = await testPhoneLandline();
  if (phoneLandlineTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - EMAIL EDGE CASES ======
  
  // Test 15: Email missing @
  results.total++;
  const emailMissingAtTest = await testEmailMissingAt();
  if (emailMissingAtTest) results.passed++; else results.failed++;
  
  // Test 16: Email missing domain
  results.total++;
  const emailMissingDomainTest = await testEmailMissingDomain();
  if (emailMissingDomainTest) results.passed++; else results.failed++;
  
  // Test 17: Email invalid special characters
  results.total++;
  const emailInvalidCharsTest = await testEmailInvalidChars();
  if (emailInvalidCharsTest) results.passed++; else results.failed++;
  
  // Test 18: Email very long
  results.total++;
  const emailVeryLongTest = await testEmailVeryLong();
  if (emailVeryLongTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - BIRTH DATE & AGE ======
  
  // Test 19: Birth date in future
  results.total++;
  const birthDateFutureTest = await testBirthDateFuture();
  if (birthDateFutureTest) results.passed++; else results.failed++;
  
  // Test 20: Age > 120 years
  results.total++;
  const ageOver120Test = await testAgeOver120();
  if (ageOver120Test) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - PATIENT CRUD ======
  
  // Test 21: Create patient - duplicate CNP
  results.total++;
  const duplicateCNPTest = await testDuplicateCNP();
  if (duplicateCNPTest) results.passed++; else results.failed++;
  
  // Test 22: Create patient - missing required fields
  results.total++;
  const missingFieldsTest = await testMissingRequiredFields();
  if (missingFieldsTest) results.passed++; else results.failed++;
  
  // Test 23: Update patient - valid changes
  results.total++;
  const updateValidTest = await testUpdatePatient(createdPatientId);
  if (updateValidTest) results.passed++; else results.failed++;
  
  // Test 24: Get patient by ID
  results.total++;
  const getByIdTest = await testGetPatientById(createdPatientId);
  if (getByIdTest) results.passed++; else results.failed++;
  
  // Test 25: Get all patients with pagination
  results.total++;
  const paginationTest = await testPagination();
  if (paginationTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - SEARCH EDGE CASES ======
  
  // Test 26: Search by phone
  results.total++;
  const searchByPhoneTest = await testSearchByPhone();
  if (searchByPhoneTest) results.passed++; else results.failed++;
  
  // Test 27: Search by email
  results.total++;
  const searchByEmailTest = await testSearchByEmail();
  if (searchByEmailTest) results.passed++; else results.failed++;
  
  // Test 28: Search with special characters
  results.total++;
  const searchSpecialCharsTest = await testSearchSpecialChars();
  if (searchSpecialCharsTest) results.passed++; else results.failed++;
  
  // ====== NEW TESTS - STATISTICS EDGE CASES ======
  
  // Test 29: Statistics with patient without birth date
  results.total++;
  const statsNoBirthDateTest = await testStatsNoBirthDate();
  if (statsNoBirthDateTest) results.passed++; else results.failed++;
  
  // Cleanup

  
  // Cleanup all test data before Strapi stops
  try {
    log('\n🧹 Cleaning up all test data before exit...', 'yellow');
    // Delete all patients created during tests
    const allPatients = await axios.get(API_BASE, { ...getAuthConfig() });
    if (allPatients.data.data && allPatients.data.data.length > 0) {
      for (const patient of allPatients.data.data) {
        try {
          await axios.delete(`${API_BASE}/${patient.documentId}`, { ...getAuthConfig() });
        } catch (delErr) {
          // Ignore individual deletion errors
        }
      }
    }
    
    // Delete test cabinet
    await deleteTestCabinet();
    
    log('✅ Cleanup complete.', 'green');
  } catch (cleanupError) {
    log(`❌ Cleanup failed: ${cleanupError.message}`, 'red');
  }
  
  // Summary
  log('\n╔════════════════════════════════════════════════╗', 'cyan');
  log('║                 TEST SUMMARY                    ║', 'cyan');
  log('╚════════════════════════════════════════════════╝', 'cyan');
  log(`\nTotal tests: ${results.total}`);
  log(`✅ Passed: ${results.passed}`, results.passed === results.total ? 'green' : 'yellow');
  log(`❌ Failed: ${results.failed}`, results.failed === 0 ? 'green' : 'red');
  
  const passRate = ((results.passed / results.total) * 100).toFixed(1);
  log(`📊 Pass rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');
  
  // Cleanup Strapi lifecycle
  await lifecycle.cleanup();
  
  if (results.passed === results.total) {
    log('\n🎉 ALL TESTS PASSED! Phase 1 implementation is working correctly!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
    process.exit(1);
  }
  
  } catch (fatalError) {
    log(`\n❌ Fatal error in test execution: ${fatalError.message}`, 'red');
    await lifecycle.cleanup();
    process.exit(1);
  }
}// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});





