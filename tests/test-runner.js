/**
 * Test Runner with Integrated Strapi Management
 * Starts Strapi once, runs all tests, then stops Strapi
 */

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');

// Configuration
const CONFIG = {
  STRAPI_PORT: 1337,
  STRAPI_URL: 'http://localhost:1337',
  STARTUP_TIMEOUT: 60000, // 60 seconds
  SHUTDOWN_TIMEOUT: 10000, // 10 seconds
  HEALTH_CHECK_INTERVAL: 2000, // 2 seconds
};

// Color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

let strapiProcess = null;
let isShuttingDown = false;

/**
 * Check if Strapi is responding
 */
async function checkStrapiHealth() {
  try {
    await axios.get(`${CONFIG.STRAPI_URL}/_health`, { timeout: 5000 });
    return true;
  } catch (error) {
    // Try alternative health check
    try {
      await axios.get(`${CONFIG.STRAPI_URL}/api/pacients?pagination[limit]=1`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Wait for Strapi to be ready
 */
async function waitForStrapi() {
  const startTime = Date.now();
  
  while (Date.now() - startTime < CONFIG.STARTUP_TIMEOUT) {
    const isHealthy = await checkStrapiHealth();
    if (isHealthy) {
      return true;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, CONFIG.HEALTH_CHECK_INTERVAL));
  }
  
  return false;
}

/**
 * Start Strapi process
 */
function startStrapi() {
  return new Promise((resolve, reject) => {
    console.log(`${colors.cyan}🚀 Starting Strapi backend...${colors.reset}`);
    
    strapiProcess = spawn('npm', ['run', 'develop'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let startupComplete = false;

    // Capture output to detect when Strapi is ready
    strapiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Log important messages
      if (output.includes('error') || output.includes('Error')) {
        console.error(`${colors.red}⚠️  ${output.trim()}${colors.reset}`);
      }
      
      // Detect successful startup
      if (output.includes('Strapi started successfully') || output.includes('started successfully')) {
        if (!startupComplete) {
          startupComplete = true;
          console.log(`${colors.green}✓ Strapi started successfully${colors.reset}`);
          resolve();
        }
      }
    });

    strapiProcess.stderr.on('data', (data) => {
      const output = data.toString();
      // Only log actual errors, not warnings
      if (output.includes('Error:') && !output.includes('warn:')) {
        console.error(`${colors.red}❌ Strapi error: ${output.trim()}${colors.reset}`);
      }
    });

    strapiProcess.on('close', (code) => {
      if (!isShuttingDown && code !== 0) {
        console.error(`${colors.red}❌ Strapi exited unexpectedly with code ${code}${colors.reset}`);
        reject(new Error(`Strapi process exited with code ${code}`));
      }
    });

    // Timeout fallback
    setTimeout(() => {
      if (!startupComplete) {
        console.log(`${colors.yellow}⏳ Waiting for Strapi health check...${colors.reset}`);
        resolve();
      }
    }, 30000);
  });
}

/**
 * Stop Strapi process
 */
function stopStrapi() {
  return new Promise((resolve) => {
    if (!strapiProcess) {
      resolve();
      return;
    }

    isShuttingDown = true;
    console.log(`${colors.yellow}🛑 Stopping Strapi...${colors.reset}`);

    strapiProcess.on('close', () => {
      strapiProcess = null;
      console.log(`${colors.gray}✓ Strapi stopped${colors.reset}`);
      resolve();
    });

    // Try graceful shutdown first
    strapiProcess.kill('SIGTERM');

    // Force kill after timeout
    setTimeout(() => {
      if (strapiProcess) {
        strapiProcess.kill('SIGKILL');
        strapiProcess = null;
        resolve();
      }
    }, CONFIG.SHUTDOWN_TIMEOUT);
  });
}

/**
 * Run a test file
 */
async function runTestFile(testFile) {
  return new Promise((resolve) => {
    console.log(`\n${colors.cyan}▶ Running: ${testFile}${colors.reset}\n`);
    
    const testProcess = spawn('node', [testFile], {
      cwd: path.join(__dirname),
      stdio: 'inherit',
      shell: true,
    });

    testProcess.on('close', (code) => {
      resolve(code);
    });
  });
}

/**
 * Main test execution
 */
async function main() {
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║          Dental Backend - Integrated Test Runner          ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  const testResults = {
    passed: 0,
    failed: 0,
    files: [],
  };

  try {
    // Step 0: Check and free port 1337 if needed (Windows only)
    const net = require('net');
    const port = CONFIG.STRAPI_PORT;
    function checkPort(port) {
      return new Promise((resolve) => {
        const tester = net.createServer()
          .once('error', err => (err.code === 'EADDRINUSE' ? resolve(false) : resolve(true)))
          .once('listening', () => tester.once('close', () => resolve(true)).close())
          .listen(port);
      });
    }
    const isFree = await checkPort(port);
    if (!isFree) {
      console.log(`${colors.yellow}⚠️  Port ${port} is in use. Attempting to free it...${colors.reset}`);
      const { execSync } = require('child_process');
      try {
        // Find and kill process on port 1337 (Windows only)
        execSync('powershell -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort 1337 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess | Stop-Process -Force"');
        console.log(`${colors.green}✓ Port ${port} has been freed.${colors.reset}`);
      } catch (e) {
        console.log(`${colors.red}❌ Failed to free port ${port}: ${e.message}${colors.reset}`);
        throw e;
      }
    }

    // Step 1: Start Strapi
    await startStrapi();
    
    // Step 2: Wait for Strapi to be fully ready
    console.log(`${colors.yellow}⏳ Waiting for Strapi to be ready...${colors.reset}`);
    const isReady = await waitForStrapi();
    
    if (!isReady) {
      throw new Error('Strapi failed to start within timeout period');
    }
    
    console.log(`${colors.green}✓ Strapi is ready for testing${colors.reset}\n`);
    
    // Step 3: Run all test files
    const testFiles = [
      'phase-1-patient.test.js',
      'phase-2-treatment.test.js',
      'phase-3-visit.test.js',
      'phase-4-advanced.test.js',
    ];

    for (const testFile of testFiles) {
      const exitCode = await runTestFile(testFile);
      
      if (exitCode === 0) {
        testResults.passed++;
        testResults.files.push({ file: testFile, passed: true });
      } else {
        testResults.failed++;
        testResults.files.push({ file: testFile, passed: false });
      }
    }

  } catch (error) {
    console.error(`${colors.red}❌ Test execution failed: ${error.message}${colors.reset}`);
    testResults.failed++;
  } finally {
    // Step 4: Stop Strapi
    await stopStrapi();
  }

  // Print summary
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                      FINAL RESULTS                         ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  testResults.files.forEach(({ file, passed }) => {
    const icon = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`  ${icon} ${file}`);
  });

  console.log(`\n  Test Files Passed: ${colors.green}${testResults.passed}${colors.reset}`);
  console.log(`  Test Files Failed: ${colors.red}${testResults.failed}${colors.reset}`);
  console.log(`  Total Test Files:  ${testResults.passed + testResults.failed}\n`);

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle termination signals
process.on('SIGINT', async () => {
  console.log(`\n${colors.yellow}⚠️  Interrupted, cleaning up...${colors.reset}`);
  await stopStrapi();
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log(`\n${colors.yellow}⚠️  Terminated, cleaning up...${colors.reset}`);
  await stopStrapi();
  process.exit(143);
});

// Run tests
main().catch((error) => {
  console.error(`${colors.red}❌ Unexpected error: ${error.message}${colors.reset}`);
  stopStrapi().then(() => process.exit(1));
});
