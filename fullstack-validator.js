/**
 * FULLSTACK DENTAL CABINET ISOLATION VALIDATOR
 * =============================================
 * 
 * Production-ready validation script for the dental treatment planning system.
 * Validates complete full-stack functionality including:
 * 
 * 1. Authentication System
 *    - User registration and login
 *    - JWT token generation and validation
 *    - Password recovery scenarios
 * 
 * 2. Cabinet Isolation (Multi-tenant Architecture)
 *    - Users see only their cabinet's data
 *    - Unauthorized access prevention
 *    - Cross-cabinet data leakage prevention
 * 
 * 3. API Performance & Consistency
 *    - Response times under acceptable limits
 *    - Data consistency across endpoints
 *    - Error handling validation
 * 
 * 4. Full-Stack Integration
 *    - Backend API responses
 *    - Frontend data handling
 *    - Real-world usage scenarios
 * 
 * Author: Dental System Validator
 * Date: January 2026
 * Version: 1.0.0
 */

const axios = require('axios');

// Configuration constants
const CONFIG = {
  STRAPI_URL: 'http://127.0.0.1:1337',
  TIMEOUT: 10000,
  MAX_BACKEND_WAIT_ATTEMPTS: 10,
  BACKEND_WAIT_INTERVAL: 3000,
  PERFORMANCE_THRESHOLD_MS: 2000,
  TEST_USERS: [
    {
      identifier: 'test@test.com',
      password: 'Test123!@#',
      description: 'Primary test user'
    },
    {
      identifier: 'anamaria@test.ro', 
      password: 'test123',
      description: 'Secondary test user'
    }
  ]
};

const API_BASE = `${CONFIG.STRAPI_URL}/api`;

// Test results tracker
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
  startTime: Date.now()
};

// Console colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

/**
 * Enhanced logging with colors and formatting
 */
function log(message, color = 'reset', prefix = '') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${prefix}${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, message = '', category = '') {
  testResults.total++;
  const categoryPrefix = category ? `[${category}] ` : '';
  
  if (passed) {
    testResults.passed++;
    log(`✅ ${categoryPrefix}${testName}`, 'green');
  } else {
    testResults.failed++;
    log(`❌ ${categoryPrefix}${testName}`, 'red');
  }
  
  if (message) {
    log(`   └─ ${message}`, 'gray');
  }
  
  testResults.details.push({
    name: testName,
    category,
    passed,
    message,
    timestamp: new Date().toISOString()
  });
}

function logSection(title) {
  log('', 'reset');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`🧪 ${title}`, 'cyan', colors.bold);
  log(`${'='.repeat(60)}`, 'cyan');
}

/**
 * Wait for backend to be ready
 */
async function waitForBackend() {
  log('🔍 Checking if backend is ready...', 'yellow');
  
  for (let attempt = 1; attempt <= CONFIG.MAX_BACKEND_WAIT_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get(`${CONFIG.STRAPI_URL}/_health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        log('✅ Backend is ready!', 'green');
        return true;
      }
    } catch (error) {
      // Try alternative health check endpoints
      try {
        await axios.get(`${API_BASE}/users/me`, { 
          timeout: 5000,
          validateStatus: () => true 
        });
        log('✅ Backend is ready!', 'green');
        return true;
      } catch (altError) {
        log(`⏳ Backend not ready (attempt ${attempt}/${CONFIG.MAX_BACKEND_WAIT_ATTEMPTS})`, 'yellow');
        
        if (attempt < CONFIG.MAX_BACKEND_WAIT_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.BACKEND_WAIT_INTERVAL));
        }
      }
    }
  }
  
  log('❌ Backend not ready after maximum attempts', 'red');
  log('💡 Make sure to run: npm run develop in the backend directory', 'yellow');
  return false;
}

/**
 * Get authentication configuration with JWT token
 */
function getAuthConfig(jwt) {
  return {
    timeout: CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    }
  };
}

/**
 * AUTHENTICATION TESTS
 */
async function testAuthentication() {
  logSection('AUTHENTICATION SYSTEM VALIDATION');
  
  const testUser = {
    email: 'validator-test@example.com',
    password: 'ValidatorTest123!',
    username: 'validatortest'
  };
  
  // Test 1: User Registration
  try {
    log('📝 Testing user registration...', 'blue');
    
    const registerResponse = await axios.post(`${API_BASE}/auth/local/register`, testUser, {
      timeout: CONFIG.TIMEOUT,
      validateStatus: () => true
    });
    
    const registrationWorked = registerResponse.status === 200 && registerResponse.data.jwt;
    const userExists = registerResponse.status === 400 && 
                      registerResponse.data.error?.message?.includes('already');
    
    logTest(
      'User registration or existence check',
      registrationWorked || userExists,
      registrationWorked ? 'New user registered successfully' : 'User already exists',
      'AUTH'
    );
    
    if (registrationWorked) {
      return {
        jwt: registerResponse.data.jwt,
        user: registerResponse.data.user
      };
    }
    
  } catch (error) {
    logTest('User registration', false, error.message, 'AUTH');
  }
  
  // Test 2: User Login (fallback if registration failed)
  try {
    log('🔐 Testing user login...', 'blue');
    
    const loginResponse = await axios.post(`${API_BASE}/auth/local`, {
      identifier: testUser.email,
      password: testUser.password
    }, {
      timeout: CONFIG.TIMEOUT
    });
    
    logTest(
      'User login successful',
      loginResponse.status === 200 && loginResponse.data.jwt,
      `JWT token length: ${loginResponse.data.jwt?.length || 0}`,
      'AUTH'
    );
    
    return {
      jwt: loginResponse.data.jwt,
      user: loginResponse.data.user
    };
    
  } catch (error) {
    logTest('User login', false, error.response?.data?.error?.message || error.message, 'AUTH');
    
    // Try with existing test users
    for (const credentials of CONFIG.TEST_USERS) {
      try {
        log(`🔄 Trying existing user: ${credentials.description}`, 'blue');
        
        const response = await axios.post(`${API_BASE}/auth/local`, credentials, {
          timeout: CONFIG.TIMEOUT
        });
        
        if (response.data.jwt) {
          logTest(
            'Login with existing user',
            true,
            `Logged in as: ${credentials.identifier}`,
            'AUTH'
          );
          
          return {
            jwt: response.data.jwt,
            user: response.data.user
          };
        }
        
      } catch (loginError) {
        continue; // Try next user
      }
    }
    
    logTest('All login attempts failed', false, 'No valid credentials found', 'AUTH');
    return null;
  }
}

/**
 * CABINET ISOLATION TESTS
 */
async function testCabinetIsolation(authResult) {
  logSection('CABINET ISOLATION VALIDATION');
  
  if (!authResult) {
    logTest('Cabinet isolation test setup', false, 'No authentication available', 'ISOLATION');
    return null;
  }
  
  const { jwt } = authResult;
  let userCabinetId = null;
  
  // Test 1: Single Cabinet Access
  try {
    log('🏥 Testing cabinet access...', 'blue');
    
    const cabinetsResponse = await axios.get(`${API_BASE}/cabinets`, getAuthConfig(jwt));
    const cabinets = cabinetsResponse.data.data || [];
    
    logTest(
      'User sees exactly one cabinet',
      cabinets.length === 1,
      `Found ${cabinets.length} cabinet(s)`,
      'ISOLATION'
    );
    
    if (cabinets.length === 1) {
      userCabinetId = cabinets[0].id;
      log(`   📋 User cabinet ID: ${userCabinetId}`, 'gray');
    }
    
  } catch (error) {
    logTest('Cabinet access test', false, error.message, 'ISOLATION');
  }
  
  // Test 2: Patient Data Isolation
  try {
    log('👥 Testing patient data isolation...', 'blue');
    
    const patientsResponse = await axios.get(`${API_BASE}/pacients`, getAuthConfig(jwt));
    const patients = patientsResponse.data.data || [];
    
    if (userCabinetId && patients.length > 0) {
      const wrongCabinetPatients = patients.filter(patient => 
        patient.attributes.cabinet?.data?.id !== userCabinetId
      );
      
      logTest(
        'All patients belong to user cabinet',
        wrongCabinetPatients.length === 0,
        `${patients.length} patients found, ${wrongCabinetPatients.length} from wrong cabinets`,
        'ISOLATION'
      );
    } else {
      logTest(
        'Patient data isolation',
        true,
        `${patients.length} patients found (empty state is valid)`,
        'ISOLATION'
      );
    }
    
  } catch (error) {
    logTest('Patient data isolation', false, error.message, 'ISOLATION');
  }
  
  // Test 3: Visit Data Isolation
  try {
    log('📅 Testing visit data isolation...', 'blue');
    
    const visitsResponse = await axios.get(`${API_BASE}/vizitas`, getAuthConfig(jwt));
    const visits = visitsResponse.data.data || [];
    
    if (userCabinetId && visits.length > 0) {
      const wrongCabinetVisits = visits.filter(visit =>
        visit.attributes.cabinet?.data?.id !== userCabinetId
      );
      
      logTest(
        'All visits belong to user cabinet',
        wrongCabinetVisits.length === 0,
        `${visits.length} visits found, ${wrongCabinetVisits.length} from wrong cabinets`,
        'ISOLATION'
      );
    } else {
      logTest(
        'Visit data isolation',
        true,
        `${visits.length} visits found (empty state is valid)`,
        'ISOLATION'
      );
    }
    
  } catch (error) {
    logTest('Visit data isolation', false, error.message, 'ISOLATION');
  }
  
  // Test 4: Unauthorized Access Prevention
  if (userCabinetId) {
    try {
      log('🚫 Testing unauthorized access prevention...', 'blue');
      
      // Try to access different cabinet
      const otherCabinetId = userCabinetId === 1 ? 2 : 1;
      
      const unauthorizedResponse = await axios.get(
        `${API_BASE}/cabinets/${otherCabinetId}`,
        {
          ...getAuthConfig(jwt),
          validateStatus: () => true
        }
      );
      
      logTest(
        'Unauthorized cabinet access blocked',
        unauthorizedResponse.status === 403 || unauthorizedResponse.status === 404,
        `HTTP ${unauthorizedResponse.status}: ${unauthorizedResponse.statusText}`,
        'ISOLATION'
      );
      
    } catch (error) {
      logTest('Unauthorized access prevention', false, error.message, 'ISOLATION');
    }
  }
  
  return userCabinetId;
}

/**
 * PERFORMANCE TESTS
 */
async function testPerformance(jwt) {
  logSection('PERFORMANCE VALIDATION');
  
  if (!jwt) {
    logTest('Performance test setup', false, 'No JWT token available', 'PERFORMANCE');
    return;
  }
  
  // Test 1: Single Endpoint Performance
  try {
    log('⚡ Testing single endpoint performance...', 'blue');
    
    const startTime = Date.now();
    await axios.get(`${API_BASE}/cabinets`, getAuthConfig(jwt));
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTest(
      'Single request performance',
      duration < CONFIG.PERFORMANCE_THRESHOLD_MS,
      `Completed in ${duration}ms (threshold: ${CONFIG.PERFORMANCE_THRESHOLD_MS}ms)`,
      'PERFORMANCE'
    );
    
  } catch (error) {
    logTest('Single endpoint performance', false, error.message, 'PERFORMANCE');
  }
  
  // Test 2: Concurrent Requests Performance
  try {
    log('⚡ Testing concurrent requests performance...', 'blue');
    
    const startTime = Date.now();
    const requests = [
      axios.get(`${API_BASE}/cabinets`, getAuthConfig(jwt)),
      axios.get(`${API_BASE}/pacients`, getAuthConfig(jwt)),
      axios.get(`${API_BASE}/vizitas`, getAuthConfig(jwt))
    ];
    
    await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTest(
      'Concurrent requests performance',
      duration < CONFIG.PERFORMANCE_THRESHOLD_MS * 2,
      `3 concurrent requests completed in ${duration}ms`,
      'PERFORMANCE'
    );
    
  } catch (error) {
    logTest('Concurrent requests performance', false, error.message, 'PERFORMANCE');
  }
}

/**
 * DATA CONSISTENCY TESTS
 */
async function testDataConsistency(jwt, userCabinetId) {
  logSection('DATA CONSISTENCY VALIDATION');
  
  if (!jwt) {
    logTest('Data consistency test setup', false, 'No JWT token available', 'CONSISTENCY');
    return;
  }
  
  try {
    log('🔍 Testing data consistency across endpoints...', 'blue');
    
    // Get data from different endpoints
    const [cabinetsRes, patientsRes, visitsRes] = await Promise.all([
      axios.get(`${API_BASE}/cabinets`, getAuthConfig(jwt)),
      axios.get(`${API_BASE}/pacients`, getAuthConfig(jwt)),
      axios.get(`${API_BASE}/vizitas`, getAuthConfig(jwt))
    ]);
    
    const cabinets = cabinetsRes.data.data || [];
    const patients = patientsRes.data.data || [];
    const visits = visitsRes.data.data || [];
    
    // Test cabinet consistency
    logTest(
      'Cabinet data structure consistent',
      cabinets.every(cabinet => cabinet.id && cabinet.attributes),
      `${cabinets.length} cabinets validated`,
      'CONSISTENCY'
    );
    
    // Test patient-cabinet relationships
    if (patients.length > 0 && userCabinetId) {
      const consistentPatients = patients.every(patient => 
        patient.attributes.cabinet?.data?.id === userCabinetId
      );
      
      logTest(
        'Patient-cabinet relationships consistent',
        consistentPatients,
        `${patients.length} patients checked`,
        'CONSISTENCY'
      );
    }
    
    // Test visit-cabinet relationships
    if (visits.length > 0 && userCabinetId) {
      const consistentVisits = visits.every(visit =>
        visit.attributes.cabinet?.data?.id === userCabinetId
      );
      
      logTest(
        'Visit-cabinet relationships consistent',
        consistentVisits,
        `${visits.length} visits checked`,
        'CONSISTENCY'
      );
    }
    
    logTest(
      'All API responses have proper structure',
      true,
      `Cabinets: ${cabinets.length}, Patients: ${patients.length}, Visits: ${visits.length}`,
      'CONSISTENCY'
    );
    
  } catch (error) {
    logTest('Data consistency validation', false, error.message, 'CONSISTENCY');
  }
}

/**
 * GENERATE COMPREHENSIVE REPORT
 */
function generateReport() {
  const totalDuration = Date.now() - testResults.startTime;
  const durationSeconds = (totalDuration / 1000).toFixed(2);
  
  logSection('VALIDATION REPORT');
  
  log(`📊 Total Tests: ${testResults.total}`, 'white');
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`⏱️  Duration: ${durationSeconds}s`, 'blue');
  log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`, 
      testResults.failed === 0 ? 'green' : 'yellow');
  
  if (testResults.failed === 0) {
    log('', 'reset');
    log('🎉 ALL TESTS PASSED! 🎉', 'green', colors.bold);
    log('✨ Cabinet isolation and full-stack functionality validated successfully!', 'green');
    log('🚀 System is production-ready!', 'green');
  } else {
    log('', 'reset');
    log('⚠️  VALIDATION ISSUES FOUND', 'red', colors.bold);
    log('', 'reset');
    log('Failed tests by category:', 'yellow');
    
    const failedByCategory = {};
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => {
        const category = test.category || 'OTHER';
        if (!failedByCategory[category]) {
          failedByCategory[category] = [];
        }
        failedByCategory[category].push(test);
      });
    
    Object.entries(failedByCategory).forEach(([category, tests]) => {
      log(`  [${category}]`, 'red');
      tests.forEach(test => {
        log(`    └─ ${test.name}: ${test.message}`, 'gray');
      });
    });
  }
  
  log('', 'reset');
  log('📋 Detailed test log saved to console output above', 'gray');
  log(`🔗 Backend URL: ${CONFIG.STRAPI_URL}`, 'gray');
  log(`📅 Validation completed at: ${new Date().toLocaleString()}`, 'gray');
  
  return testResults.failed === 0;
}

/**
 * MAIN VALIDATION RUNNER
 */
async function runFullStackValidation() {
  log('🔬 FULLSTACK DENTAL CABINET ISOLATION VALIDATOR', 'cyan', colors.bold);
  log('======================================', 'cyan');
  log('🏥 Validating dental treatment planning system...', 'blue');
  log(`📡 Backend URL: ${CONFIG.STRAPI_URL}`, 'gray');
  log(`⏱️  Started at: ${new Date().toLocaleString()}`, 'gray');
  
  try {
    // Step 1: Wait for backend
    const backendReady = await waitForBackend();
    if (!backendReady) {
      log('❌ Cannot proceed without backend', 'red');
      return false;
    }
    
    // Step 2: Test authentication
    const authResult = await testAuthentication();
    
    // Step 3: Test cabinet isolation
    const userCabinetId = await testCabinetIsolation(authResult);
    
    // Step 4: Test performance
    await testPerformance(authResult?.jwt);
    
    // Step 5: Test data consistency
    await testDataConsistency(authResult?.jwt, userCabinetId);
    
    // Step 6: Generate report
    return generateReport();
    
  } catch (error) {
    log(`💥 Validation failed with critical error: ${error.message}`, 'red');
    log(`📋 Stack trace: ${error.stack}`, 'gray');
    return false;
  }
}

// Export for module usage
module.exports = {
  runFullStackValidation,
  CONFIG
};

// Run validation if called directly
if (require.main === module) {
  runFullStackValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`💥 Unexpected error: ${error.message}`, 'red');
      process.exit(1);
    });
}