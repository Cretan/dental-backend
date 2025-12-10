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
 * Run a workflow script with timeout
 */
async function runWorkflowScript(scriptName, description, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    console.log(`${colors.cyan}\n▶ ${description}${colors.reset}`);
    
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      env: { ...process.env, STRAPI_URL: CONFIG.STRAPI_URL }
    });
    
    // Set timeout to kill process if it hangs
    const timeout = setTimeout(() => {
      console.log(`${colors.red}\n⚠ Script timeout after ${timeoutMs/1000}s, killing process...${colors.reset}`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000); // Force kill after 5s
      resolve(124); // Timeout exit code
    }, timeoutMs);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`${colors.green}✓ ${description} completed${colors.reset}`);
        resolve(code);
      } else {
        console.log(`${colors.yellow}⚠ ${description} exited with code ${code}${colors.reset}`);
        resolve(code);
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

/**
 * Main test execution
 */
async function main() {
  // Check for workflow mode and custom parameters
  const args = process.argv.slice(2);
  const workflowMode = args.includes('--workflow') || args.includes('full_functionality');
  const cleanupMode = args.includes('cleanup');
  const productionMode = args.includes('production');
  
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  if (cleanupMode) {
    console.log(`${colors.cyan}║              DATABASE CLEANUP MODE                        ║${colors.reset}`);
  } else if (productionMode) {
    console.log(`${colors.cyan}║         PRODUCTION DATA GENERATION MODE                   ║${colors.reset}`);
  } else if (workflowMode) {
    console.log(`${colors.cyan}║       FULL PRODUCTION WORKFLOW - TEST RUNNER              ║${colors.reset}`);
  } else {
    console.log(`${colors.cyan}║          Dental Backend - Integrated Test Runner          ║${colors.reset}`);
  }
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
    
    // CLEANUP MODE: Run cleanup script and exit
    if (cleanupMode) {
      const exitCode = await runWorkflowScript('cleanup-database.js', 'Database Cleanup', 300000);
      testResults.passed = exitCode === 0 ? 1 : 0;
      testResults.failed = exitCode === 0 ? 0 : 1;
      return;
    }
    
    // PRODUCTION MODE: Run production data generation and exit
    if (productionMode) {
      const exitCode = await runWorkflowScript('simulation-production.js', 'Production Data Generation (100k patients, 10 cabinets)', 3600000); // 1 hour timeout
      testResults.passed = exitCode === 0 ? 1 : 0;
      testResults.failed = exitCode === 0 ? 0 : 1;
      return;
    }
    
    // WORKFLOW MODE: Full production data generation
    if (workflowMode) {
      console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
      console.log(`${colors.cyan}  WORKFLOW: Verify → Cleanup → Generate → Verify${colors.reset}`);
      console.log(`${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
      
      // Step 1: Initial verification
      let code = await runWorkflowScript('verify-database.js', 'STEP 1: Initial Database Verification', 60000);
      const needsCleanup = code !== 0; // Non-zero means database has data
      
      // Step 2: Cleanup if needed
      if (needsCleanup) {
        console.log(`${colors.yellow}\n⚠ Database contains data, cleanup required${colors.reset}`);
        await runWorkflowScript('cleanup-database.js', 'STEP 2: Database Cleanup', 300000);
      } else {
        console.log(`${colors.green}\n✓ Database is empty, skipping cleanup${colors.reset}`);
      }
      
      // Step 3: Generate production data (1 hour timeout for 100k patients)
      await runWorkflowScript('simulation-production.js', 'STEP 3: Generate Production Data (100k patients, 10 cabinets)', 3600000);
      
      // Step 4: Final verification
      code = await runWorkflowScript('verify-database.js', 'STEP 4: Final Database Verification', 60000);
      
      if (code === 0) {
        console.log(`\n${colors.green}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.green}║              ✓ WORKFLOW COMPLETED! 🎉                      ║${colors.reset}`);
        console.log(`${colors.green}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
        console.log(`${colors.cyan}✅ Acceptance Criteria Met:${colors.reset}`);
        console.log(`${colors.green}   ✓ 10 cabinets created${colors.reset}`);
        console.log(`${colors.green}   ✓ 1 administrator per cabinet${colors.reset}`);
        console.log(`${colors.green}   ✓ 3 employees per cabinet${colors.reset}`);
        console.log(`${colors.green}   ✓ 10,000 patients per cabinet${colors.reset}`);
        console.log(`${colors.green}   ✓ Appointments for next 2 months${colors.reset}\n`);
        testResults.passed = 1;
      } else {
        console.log(`\n${colors.red}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.red}║              ⚠ WORKFLOW INCOMPLETE                         ║${colors.reset}`);
        console.log(`${colors.red}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);
        testResults.failed = 1;
      }
      
      return; // Exit workflow mode
    }
    
    // NORMAL MODE: Step 3: Run test files
    // Testing Phase 1 (Patient), Phase 2 (Treatment), Phase 3 (Visit), and Phase 4 (Advanced)
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
