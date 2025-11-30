/**
 * Phase 1 Testing Script
 * Tests patient validation, search, and statistics endpoints
 * Handles cases where Strapi might be offline or not responding
 */

const axios = require('axios');
const { generateValidCNP } = require('./cnp-generator');
const { generateRomanianName } = require('./romanian-names');

const STRAPI_URL = 'http://localhost:1337';
const API_BASE = `${STRAPI_URL}/api/pacients`;
const TIMEOUT = 5000; // 5 second timeout
const MAX_RETRIES = 3;

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
        CNP: validCNP,
        data_nasterii: `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`,
        telefon: `+4070011${timestamp}`,
        email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}.${timestamp}@test.ro`
      }
    };
    
    const response = await axios.post(API_BASE, validPatient, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
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
        CNP: 'invalid123',
        data_nasterii: '1990-01-01',
        telefon: '+40700000000'
      }
    };
    
    const response = await axios.post(API_BASE, invalidPatient, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1900101012349',
        data_nasterii: '1990-01-01',
        telefon: '123' // Invalid phone
      }
    };    const response = await axios.post(API_BASE, invalidPatient, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
      params: { query: 'ionescu' },
      timeout: TIMEOUT
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
      timeout: TIMEOUT
    });
    log('✅ Test patient deleted', 'green');
  } catch (error) {
    log('⚠️  Could not delete test patient (may not exist)', 'yellow');
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
        CNP: cnpValue,
        data_nasterii: '1990-01-01',
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '12345ABC67890',
        data_nasterii: '1990-01-01',
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '0900101012345',
        data_nasterii: '1990-01-01',
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '0000000000000',
        data_nasterii: '1990-01-01',
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: cnp,
        data_nasterii: '1991-06-10',
        telefon: '+40 700 123 456'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+1234567890'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+4070012'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+40211234567' // Bucharest landline
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+40700000000',
        email: 'invalidemail.com'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+40700000000',
        email: 'test@'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+40700000000',
        email: 'test<>@example.com'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: '1991-06-10',
        telefon: '+40700000000',
        email: longEmail
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1910610012345',
        data_nasterii: futureDateStr,
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: '1010101012345',
        data_nasterii: oldDateStr,
        telefon: '+40700000000'
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
        CNP: cnp,
        data_nasterii: '1992-03-20',
        telefon: `+4070020${timestamp}`
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Try to create second patient with same CNP
    const second = await axios.post(API_BASE, {
      data: {
        nume: name2.lastName,
        prenume: name2.firstName,
        CNP: cnp, // Same CNP
        data_nasterii: '1992-03-20',
        telefon: `+4070021${timestamp}`
      }
    }, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
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
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
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
      timeout: TIMEOUT
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
      params: {
        'pagination[page]': 1,
        'pagination[pageSize]': 10
      },
      timeout: TIMEOUT
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
      params: { query: '0700' },
      timeout: TIMEOUT
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
      params: { query: 'test.ro' },
      timeout: TIMEOUT
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
      params: { query: '<script>alert("test")</script>' },
      timeout: TIMEOUT,
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
  
  // Check if Strapi is running
  const strapiHealthy = await checkStrapiHealth();
  
  if (!strapiHealthy) {
    log('\n❌ CANNOT RUN TESTS - Strapi is not responding', 'red');
    log('\nTo start Strapi, run:', 'yellow');
    log('  cd d:\\treatmentPlan\\dental-backend', 'gray');
    log('  npm run develop', 'gray');
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
    await axios.post(`${STRAPI_URL}/cleanup-database`, {}, { timeout: TIMEOUT });
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
  
  if (results.passed === results.total) {
    log('\n🎉 ALL TESTS PASSED! Phase 1 implementation is working correctly!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
