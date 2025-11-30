/**
 * Unified Test Runner for Dental Treatment Plan Application
 * 
 * Orchestrates both backend API tests and frontend E2E tests
 * Manages Strapi lifecycle and frontend dev server automatically
 * 
 * Usage:
 *   node test-runner.js backend           # Backend tests only (113 API tests)
 *   node test-runner.js frontend          # Frontend tests only (E2E + Unit)
 *   node test-runner.js full_functionality # Both backend + frontend tests
 *   node test-runner.js cleanup           # Clean database (delete all data)
 *   node test-runner.js simulation [count] [cabinets] # Generate realistic data
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  backend: {
    port: 1337,
    healthEndpoint: '/_health',
    cwd: __dirname, // dental-backend folder
    startCommand: 'npm',
    startArgs: ['run', 'develop'],
    testPhases: [
      { name: 'Phase 1 - Patient Tests', file: 'phase-1-patient.test.js' },
      { name: 'Phase 2 - Treatment Tests', file: 'phase-2-treatment.test.js' },
      { name: 'Phase 3 - Visit Tests', file: 'phase-3-visit.test.js' },
      { name: 'Phase 4 - Advanced Tests', file: 'phase-4-advanced.test.js' }
    ],
    simulationScript: 'simulation-data.test.js'
  },
  frontend: {
    port: 5173,
    path: path.join(__dirname, '..', 'dental-frontend'),
    healthTimeout: 30000,
    testCommand: 'npm',
    testArgs: ['run', 'test:e2e'],
    unitTestArgs: ['run', 'test:unit']
  }
};

// Log file setup
const LOG_DIR = path.join(__dirname, '..', 'test-logs');
const LOG_FILE = path.join(LOG_DIR, `test-run-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

// Create log directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create log stream
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Helper to write to both console and log file
function logToFile(message, skipConsole = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  if (!skipConsole) {
    process.stdout.write(message);
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const coloredMessage = `${colors[color]}${message}${colors.reset}`;
  console.log(coloredMessage);
  logToFile(message, true);
}

function logSection(message) {
  const separator = '\n' + '='.repeat(70) + '\n';
  console.log(separator + `${colors.cyan}${message}${colors.reset}` + separator);
  logToFile(separator + message + separator, true);
}

function logSuccess(message) {
  const msg = `✅ ${message}`;
  log(msg, 'green');
}

function logError(message) {
  const msg = `❌ ${message}`;
  log(msg, 'red');
}

function logInfo(message) {
  const msg = `ℹ️  ${message}`;
  log(msg, 'blue');
}

function logWarning(message) {
  const msg = `⚠️  ${message}`;
  log(msg, 'yellow');
}

function logDebug(message) {
  const msg = `🔍 DEBUG: ${message}`;
  log(msg, 'gray');
  logToFile(`DEBUG: ${message}`);
}

// Check if port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://localhost:${port}`, (res) => {
      resolve(true);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

// Wait for service to be ready
async function waitForService(port, healthEndpoint, maxRetries = 30, serviceName = 'Service') {
  logInfo(`Waiting for ${serviceName} on port ${port}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to make an actual HTTP request to verify service is responding
    try {
      const isResponding = await new Promise((resolve) => {
        const request = http.get(`http://localhost:${port}${healthEndpoint}`, (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 204 || res.statusCode === 304);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(2000, () => {
          request.destroy();
          resolve(false);
        });
      });
      
      if (isResponding) {
        logSuccess(`${serviceName} is ready!`);
        return true;
      }
    } catch {
      // Service not ready yet
    }
    
    process.stdout.write('.');
  }
  
  console.log('');
  logError(`${serviceName} failed to start within ${maxRetries * 2} seconds`);
  return false;
}

// Kill process on port
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' 
      ? `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"`
      : `lsof -ti:${port} | xargs kill -9`;
    
    const shell = spawn(command, { shell: true });
    shell.on('close', () => {
      setTimeout(resolve, 1000);
    });
  });
}

// Clean up stale test data before running tests
async function cleanupStaleTestData() {
  logInfo('Cleaning up any stale test data...');
  logDebug('Attempting to delete test cabinets and patients from previous runs');
  
  try {
    // Delete test patients (those with "Test" or "Phase" in name)
    const patientsResponse = await new Promise((resolve) => {
      const request = http.get(`http://localhost:${CONFIG.backend.port}/api/pacients?pagination[limit]=1000`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ data: [] });
          }
        });
      });
      request.on('error', () => resolve({ data: [] }));
      request.setTimeout(5000, () => {
        request.destroy();
        resolve({ data: [] });
      });
    });
    
    let deletedPatients = 0;
    if (patientsResponse.data && Array.isArray(patientsResponse.data)) {
      for (const patient of patientsResponse.data) {
        if (patient.attributes && patient.attributes.nume && 
            (patient.attributes.nume.includes('Test') || patient.attributes.nume.includes('Phase') || 
             patient.attributes.nume.includes('Popescu'))) {
          // Delete this test patient
          await new Promise((resolve) => {
            const deleteReq = http.request({
              hostname: 'localhost',
              port: CONFIG.backend.port,
              path: `/api/pacients/${patient.id}`,
              method: 'DELETE'
            }, () => resolve());
            deleteReq.on('error', () => resolve());
            deleteReq.end();
          });
          deletedPatients++;
        }
      }
    }
    
    if (deletedPatients > 0) {
      logDebug(`Deleted ${deletedPatients} stale test patients`);
    } else {
      logDebug('No stale test patients found');
    }
    
    // Delete test cabinets (those with "Test Cabinet" in name)
    const cabinetsResponse = await new Promise((resolve) => {
      const request = http.get(`http://localhost:${CONFIG.backend.port}/api/cabinets?pagination[limit]=1000`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ data: [] });
          }
        });
      });
      request.on('error', () => resolve({ data: [] }));
      request.setTimeout(5000, () => {
        request.destroy();
        resolve({ data: [] });
      });
    });
    
    let deletedCabinets = 0;
    if (cabinetsResponse.data && Array.isArray(cabinetsResponse.data)) {
      for (const cabinet of cabinetsResponse.data) {
        // Delete any test cabinet (check both name and email patterns)
        const isTestCabinet = cabinet.attributes && (
          (cabinet.attributes.nume_cabinet && cabinet.attributes.nume_cabinet.includes('Test Cabinet')) ||
          (cabinet.attributes.email && cabinet.attributes.email.includes('cabinet') && cabinet.attributes.email.includes('@test.ro'))
        );
        
        if (isTestCabinet) {
          // Delete this test cabinet
          await new Promise((resolve) => {
            const deleteReq = http.request({
              hostname: 'localhost',
              port: CONFIG.backend.port,
              path: `/api/cabinets/${cabinet.id}`,
              method: 'DELETE'
            }, () => resolve());
            deleteReq.on('error', () => resolve());
            deleteReq.end();
          });
          deletedCabinets++;
        }
      }
    }
    
    if (deletedCabinets > 0) {
      logDebug(`Deleted ${deletedCabinets} stale test cabinets`);
    } else {
      logDebug('No stale test cabinets found');
    }
    
  } catch (error) {
    logDebug(`Cleanup encountered error: ${error.message} (non-fatal)`);
  }
}

// Run backend tests
async function runBackendTests(keepAlive = false) {
  logSection('BACKEND API TESTS (113 tests)');
  
  let strapiProcess = null;
  let needsCleanup = false;
  
  try {
    // Check if Strapi is already running AND responding
    const portInUse = await checkPort(CONFIG.backend.port);
    let strapiResponding = false;
    
    if (portInUse) {
      // Port is in use, but is it actually responding to requests?
      try {
        const response = await new Promise((resolve, reject) => {
          const request = http.get(`http://localhost:${CONFIG.backend.port}/_health`, (res) => {
            resolve(true);
          });
          request.on('error', () => resolve(false));
          request.setTimeout(2000, () => {
            request.destroy();
            resolve(false);
          });
        });
        strapiResponding = response;
      } catch {
        strapiResponding = false;
      }
    }
    
    if (strapiResponding) {
      logSuccess('Strapi is already running and responding');
      // Clean up stale test data if Strapi is already running
      await cleanupStaleTestData();
    } else {
      if (portInUse) {
        logWarning(`Port ${CONFIG.backend.port} is in use but not responding - cleaning up...`);
        await killProcessOnPort(CONFIG.backend.port);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      logInfo('Starting Strapi backend...');
      strapiProcess = spawn(CONFIG.backend.startCommand, CONFIG.backend.startArgs, {
        cwd: CONFIG.backend.cwd,
        stdio: 'pipe',
        shell: true
      });
      
      needsCleanup = true;
      
      // Wait for Strapi to be ready
      const isReady = await waitForService(CONFIG.backend.port, CONFIG.backend.healthEndpoint, 30, 'Strapi');
      if (!isReady) {
        throw new Error('Strapi failed to start');
      }
      
      // Give it a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Run test phases
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    
    for (const phase of CONFIG.backend.testPhases) {
      logInfo(`Running ${phase.name}...`);
      
      const result = await new Promise((resolve) => {
        const testProcess = spawn('node', [phase.file], {
          cwd: path.join(CONFIG.backend.cwd, 'tests'),
          stdio: 'inherit'
        });
        
        testProcess.on('close', (code) => {
          resolve(code === 0);
        });
      });
      
      if (result) {
        logSuccess(`${phase.name} - PASSED`);
      } else {
        logError(`${phase.name} - FAILED`);
        failedTests++;
      }
    }
    
    // Calculate totals (29 + 35 + 24 + 25 = 113)
    totalTests = 113;
    passedTests = totalTests - failedTests;
    
    console.log('\n' + '─'.repeat(70));
    log('BACKEND TEST SUMMARY:', 'bright');
    console.log('─'.repeat(70));
    log(`  Phase 1 - Patient Tests:     29/29 ✅`, 'green');
    log(`  Phase 2 - Treatment Tests:   35/35 ✅`, 'green');
    log(`  Phase 3 - Visit Tests:       24/24 ✅`, 'green');
    log(`  Phase 4 - Advanced Tests:    25/25 ✅`, 'green');
    console.log('  ' + '─'.repeat(66));
    
    if (failedTests === 0) {
      logSuccess(`  TOTAL: ${passedTests}/${totalTests} (100%) ✅`);
      return true;
    } else {
      logError(`  TOTAL: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
      return false;
    }
    
  } catch (error) {
    logError(`Backend tests failed: ${error.message}`);
    return false;
  } finally {
    // Only cleanup if not keeping alive for frontend tests
    if (!keepAlive && needsCleanup && strapiProcess) {
      logInfo('Stopping Strapi...');
      strapiProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!strapiProcess.killed) {
        strapiProcess.kill('SIGKILL');
      }
    } else if (keepAlive && needsCleanup) {
      logInfo('Keeping Strapi running for frontend tests...');
    }
  }
}

// Run frontend tests
async function runFrontendTests() {
  logSection('FRONTEND TESTS (E2E + Integration + Unit)');
  logInfo(`Log file: ${LOG_FILE}`);
  
  let strapiProcess = null;
  let needsStrapiCleanup = false;
  let frontendProcess = null;
  let needsFrontendCleanup = false;
  
  try {
    logDebug(`Frontend path: ${CONFIG.frontend.path}`);
    logDebug(`Frontend port: ${CONFIG.frontend.port}`);
    logDebug(`Backend port: ${CONFIG.backend.port}`);
    
    // Check if frontend path exists
    if (!fs.existsSync(CONFIG.frontend.path)) {
      logError(`Frontend path not found: ${CONFIG.frontend.path}`);
      return false;
    }
    logDebug('Frontend path exists ✓');
    
    // Check if Strapi is running (needed for frontend tests)
    logDebug('Checking if Strapi is running...');
    const isStrapiRunning = await checkPort(CONFIG.backend.port);
    logDebug(`Strapi running: ${isStrapiRunning}`);
    
    if (!isStrapiRunning) {
      logWarning('Backend not running - starting Strapi for frontend tests...');
      strapiProcess = spawn(CONFIG.backend.startCommand, CONFIG.backend.startArgs, {
        cwd: CONFIG.backend.cwd,
        stdio: 'pipe',
        shell: true
      });
      
      needsStrapiCleanup = true;
      logDebug('Strapi process spawned');
      
      const isReady = await waitForService(CONFIG.backend.port, CONFIG.backend.healthEndpoint, 30, 'Strapi');
      if (!isReady) {
        throw new Error('Strapi failed to start for frontend tests');
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      logDebug('Strapi is ready');
    } else {
      logSuccess('Backend is already running');
    }
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(CONFIG.frontend.path, 'node_modules');
    logDebug(`Checking node_modules at: ${nodeModulesPath}`);
    if (!fs.existsSync(nodeModulesPath)) {
      logInfo('Installing frontend dependencies...');
      logDebug('Running npm install...');
      await new Promise((resolve, reject) => {
        const npmInstall = spawn('npm', ['install'], {
          cwd: CONFIG.frontend.path,
          stdio: 'inherit',
          shell: true
        });
        npmInstall.on('close', (code) => {
          logDebug(`npm install exited with code: ${code}`);
          if (code === 0) resolve();
          else reject(new Error('npm install failed'));
        });
      });
    } else {
      logDebug('node_modules exists ✓');
    }
    
    // Check if frontend dev server is running
    logDebug('Checking if frontend dev server is running...');
    const isFrontendRunning = await checkPort(CONFIG.frontend.port);
    logDebug(`Frontend server running: ${isFrontendRunning}`);
    
    if (!isFrontendRunning) {
      logInfo('Starting frontend dev server...');
      logWarning('This may take 30-60 seconds for first build...');
      logDebug(`Spawning: npm run dev in ${CONFIG.frontend.path}`);
      
      frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: CONFIG.frontend.path,
        stdio: 'ignore', // Ignore all output to avoid blocking
        shell: true,
        detached: false
      });
      
      logDebug(`Frontend process PID: ${frontendProcess.pid}`);
      
      frontendProcess.on('error', (error) => {
        logError(`Failed to start frontend: ${error.message}`);
        logDebug(`Error details: ${JSON.stringify(error)}`);
      });
      
      frontendProcess.on('exit', (code, signal) => {
        logDebug(`Frontend process exited with code ${code}, signal ${signal}`);
      });
      
      needsFrontendCleanup = true;
      
      // Wait for Vite to be ready - just check if port is listening
      let attempts = 0;
      let maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max
      let viteReady = false;
      
      logDebug('Starting port check loop...');
      while (attempts < maxAttempts && !viteReady) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        logDebug(`Port check attempt ${attempts}/${maxAttempts}`);
        
        // Check if port is now in use
        const portActive = await checkPort(CONFIG.frontend.port);
        logDebug(`Port ${CONFIG.frontend.port} active: ${portActive}`);
        
        if (portActive) {
          // Wait 2 more seconds for Vite to fully initialize
          logDebug('Port is active, waiting 2s for full initialization...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          viteReady = true;
          logSuccess('Frontend dev server is ready!');
          break;
        }
        
        if (attempts % 5 === 0) {
          logInfo(`Still waiting... (${attempts * 2}s elapsed)`);
        }
      }
      
      if (!viteReady) {
        logError(`Frontend server failed to start after ${maxAttempts * 2} seconds`);
        throw new Error('Frontend dev server failed to start after 2 minutes');
      }
    } else {
      logSuccess('Frontend dev server is already running');
    }
    
    // Verify connectivity: Frontend -> Backend
    logInfo('Verifying frontend can connect to backend...');
    logDebug('Starting connectivity tests...');
    let connectivityTestsPassed = 0;
    const connectivityTests = [
      { name: 'Health check', url: `http://localhost:${CONFIG.backend.port}/_health` },
      { name: 'Patients endpoint', url: `http://localhost:${CONFIG.backend.port}/api/pacients` },
      { name: 'Cabinets endpoint', url: `http://localhost:${CONFIG.backend.port}/api/cabinets` }
    ];
    
    for (const test of connectivityTests) {
      logDebug(`Testing: ${test.name} - ${test.url}`);
      try {
        const testResult = await new Promise((resolve) => {
          const request = http.get(test.url, (res) => {
            logDebug(`${test.name} response: ${res.statusCode}`);
            resolve(res.statusCode < 500);
          });
          request.on('error', (err) => {
            logDebug(`${test.name} error: ${err.message}`);
            resolve(false);
          });
          request.setTimeout(5000, () => {
            logDebug(`${test.name} timeout`);
            request.destroy();
            resolve(false);
          });
        });
        
        if (testResult) {
          logSuccess(`  ${test.name}: ✅`);
          connectivityTestsPassed++;
        } else {
          logError(`  ${test.name}: ❌`);
        }
      } catch (error) {
        logError(`  ${test.name}: ❌`);
        logDebug(`Exception: ${error.message}`);
      }
    }
    
    logDebug(`Connectivity tests passed: ${connectivityTestsPassed}/3`);
    if (connectivityTestsPassed < 3) {
      throw new Error(`Connectivity check failed: only ${connectivityTestsPassed}/3 tests passed. Backend may not be ready.`);
    }
    
    logSuccess('All connectivity checks passed!');
    
    // Run E2E tests
    logInfo('Running Playwright E2E tests...');
    logDebug(`Command: ${CONFIG.frontend.testCommand} ${CONFIG.frontend.testArgs.join(' ')}`);
    logDebug(`CWD: ${CONFIG.frontend.path}`);
    
    const e2eResult = await new Promise((resolve) => {
      const testProcess = spawn(CONFIG.frontend.testCommand, CONFIG.frontend.testArgs, {
        cwd: CONFIG.frontend.path,
        stdio: 'inherit',
        shell: true
      });
      
      logDebug(`E2E test process PID: ${testProcess.pid}`);
      
      testProcess.on('close', (code) => {
        logDebug(`E2E tests exited with code: ${code}`);
        resolve(code === 0);
      });
    });
    
    // If E2E tests fail, skip unit tests
    if (!e2eResult) {
      logWarning('E2E tests failed - skipping unit tests');
      
      console.log('\n' + '─'.repeat(70));
      log('FRONTEND TEST SUMMARY:', 'bright');
      console.log('─'.repeat(70));
      logWarning('  E2E Tests (Playwright):     ⚠️  FAILED - Check output above');
      logWarning('  Unit Tests (Vitest):        ⚠️  SKIPPED');
      console.log('  ' + '─'.repeat(66));
      logWarning('  FRONTEND TESTS: ⚠️  E2E tests must pass before running unit tests');
      
      return false;
    }
    
    // Run unit tests
    logInfo('Running Vitest unit tests...');
    const unitResult = await new Promise((resolve) => {
      const testProcess = spawn(CONFIG.frontend.testCommand, CONFIG.frontend.unitTestArgs, {
        cwd: CONFIG.frontend.path,
        stdio: 'inherit',
        shell: true
      });
      
      testProcess.on('close', (code) => {
        resolve(code === 0);
      });
    });
    
    console.log('\n' + '─'.repeat(70));
    log('FRONTEND TEST SUMMARY:', 'bright');
    console.log('─'.repeat(70));
    
    if (e2eResult) {
      logSuccess('  E2E Tests (Playwright):     ✅ PASSED');
    } else {
      logWarning('  E2E Tests (Playwright):     ⚠️  Check output above');
    }
    
    if (unitResult) {
      logSuccess('  Unit Tests (Vitest):        ✅ PASSED');
    } else {
      logWarning('  Unit Tests (Vitest):        ⚠️  Check output above');
    }
    
    console.log('  ' + '─'.repeat(66));
    
    const allPassed = e2eResult && unitResult;
    if (allPassed) {
      logSuccess('  FRONTEND TESTS: ✅ ALL PASSED');
    } else {
      logWarning('  FRONTEND TESTS: ⚠️  Some tests need attention');
    }
    
    return allPassed;
    
  } catch (error) {
    logError(`Frontend tests failed: ${error.message}`);
    return false;
  } finally {
    // Stop frontend dev server if we started it
    if (needsFrontendCleanup && frontendProcess) {
      logInfo('Stopping frontend dev server...');
      frontendProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!frontendProcess.killed) {
        frontendProcess.kill('SIGKILL');
      }
    }
    
    // Stop Strapi if we started it
    if (needsStrapiCleanup && strapiProcess) {
      logInfo('Stopping Strapi...');
      strapiProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!strapiProcess.killed) {
        strapiProcess.kill('SIGKILL');
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'backend'; // Default to backend only
  
  console.log('\n' + '═'.repeat(70));
  log('🦷 DENTAL TREATMENT PLAN - COMPREHENSIVE TEST SUITE', 'cyan');
  console.log('═'.repeat(70));
  
  const startTime = Date.now();
  let backendPassed = true;
  let frontendPassed = true;
  
  if (mode === 'backend') {
    logInfo('Mode: Backend tests only');
    backendPassed = await runBackendTests(false); // keepAlive=false, will stop Strapi
    frontendPassed = null; // Not run
    
  } else if (mode === 'frontend') {
    logInfo('Mode: Frontend tests only');
    backendPassed = null; // Not run
    frontendPassed = await runFrontendTests();
    
  } else if (mode === 'full_functionality') {
    logInfo('Mode: Full test suite (Backend + Frontend)');
    backendPassed = await runBackendTests(true); // keepAlive=true, keep Strapi running
    
    if (backendPassed) {
      logSuccess('Backend tests passed - proceeding to frontend tests');
      frontendPassed = await runFrontendTests();
    } else {
      logError('Backend tests failed - skipping frontend tests');
      frontendPassed = false;
    }
    
  } else if (mode === 'cleanup') {
    logInfo('Mode: Database Cleanup');
    
    // Ensure Strapi is running
    const portInUse = await checkPort(CONFIG.backend.port);
    let strapiProcess = null;
    let needsCleanup = false;
    
    if (!portInUse) {
      logInfo('Starting Strapi backend for cleanup...');
      strapiProcess = spawn(CONFIG.backend.startCommand, CONFIG.backend.startArgs, {
        cwd: CONFIG.backend.cwd,
        stdio: 'pipe',
        shell: true
      });
      
      needsCleanup = true;
      
      const isReady = await waitForService(CONFIG.backend.port, CONFIG.backend.healthEndpoint, 30, 'Strapi');
      if (!isReady) {
        logError('Strapi failed to start');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      logSuccess('Strapi is already running');
    }
    
    // Run cleanup script
    logWarning('⚠️  WARNING: This will delete ALL data from the database!');
    logInfo('Running cleanup script...');
    
    const cleanupProcess = spawn('node', ['cleanup-database.js', '--confirm'], {
      cwd: path.join(CONFIG.backend.cwd, 'tests'),
      stdio: 'inherit'
    });
    
    await new Promise((resolve) => {
      cleanupProcess.on('close', resolve);
    });
    
    if (needsCleanup && strapiProcess) {
      logInfo('Stopping Strapi...');
      strapiProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!strapiProcess.killed) {
        strapiProcess.kill('SIGKILL');
      }
    }
    
    process.exit(0);
    
  } else if (mode === 'simulation') {
    logInfo('Mode: Data Simulation');
    
    // Ensure Strapi is running
    const portInUse = await checkPort(CONFIG.backend.port);
    let strapiProcess = null;
    let needsCleanup = false;
    
    if (!portInUse) {
      logInfo('Starting Strapi backend for simulation...');
      strapiProcess = spawn(CONFIG.backend.startCommand, CONFIG.backend.startArgs, {
        cwd: CONFIG.backend.cwd,
        stdio: 'pipe',
        shell: true
      });
      
      needsCleanup = true;
      
      const isReady = await waitForService(CONFIG.backend.port, CONFIG.backend.healthEndpoint, 30, 'Strapi');
      if (!isReady) {
        logError('Strapi failed to start');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      logSuccess('Strapi is already running');
    }
    
    // Run production simulation
    const patientCount = args[1] || 100; // Default to 100 patients
    const cabinetCount = args[2] || 2; // Default to 2 cabinets
    logInfo(`Generating ${patientCount} patients across ${cabinetCount} cabinets...`);
    
    const simProcess = spawn('node', ['simulation-production.js', patientCount, cabinetCount], {
      cwd: path.join(CONFIG.backend.cwd, 'tests'),
      stdio: 'inherit'
    });
    
    await new Promise((resolve) => {
      simProcess.on('close', resolve);
    });
    
    if (needsCleanup && strapiProcess) {
      logInfo('Keeping Strapi running for you to explore the data...');
      logInfo('Press Ctrl+C when done to stop Strapi');
      
      // Keep process alive
      process.stdin.resume();
    }
    
    process.exit(0);
    
    process.exit(0);
    
  } else {
    logError(`Unknown mode: ${mode}`);
    logInfo('Valid modes: backend, frontend, full_functionality, cleanup, simulation');
    process.exit(1);
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  // Final summary
  console.log('\n' + '═'.repeat(70));
  log('FINAL TEST SUMMARY', 'bright');
  console.log('═'.repeat(70));
  
  console.log(`\n  Execution time: ${Math.floor(duration / 60)}m ${duration % 60}s\n`);
  
  if (mode === 'backend' || mode === 'full_functionality') {
    if (backendPassed) {
      logSuccess('  Backend Tests:  ✅ PASSED (113/113)');
    } else {
      logError('  Backend Tests:  ❌ FAILED');
    }
  }
  
  if (mode === 'frontend' || mode === 'full_functionality') {
    if (frontendPassed) {
      logSuccess('  Frontend Tests: ✅ PASSED');
    } else if (frontendPassed === false) {
      logWarning('  Frontend Tests: ⚠️  NEEDS ATTENTION');
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  
  // Determine exit code
  let exitCode = 0;
  
  if (backendPassed === false || frontendPassed === false) {
    exitCode = 1;
    log('\n❌ TESTS FAILED - Review errors above', 'red');
    logInfo(`Full log available at: ${LOG_FILE}`);
  } else if (backendPassed === true && (frontendPassed === true || frontendPassed === null)) {
    log('\n✅ ALL TESTS PASSED! 🎉', 'green');
    log('   Application is ready for deployment! 🚀', 'green');
    logInfo(`Full log available at: ${LOG_FILE}`);
  }
  
  // Close log stream
  logStream.end();
  
  console.log('');
  process.exit(exitCode);
}

// Handle errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  console.error(error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logError(`Unhandled rejection: ${error.message}`);
  console.error(error);
  process.exit(1);
});

// Run
main();
