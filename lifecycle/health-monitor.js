/**
 * Backend Health Monitor and Auto-Restart System
 * Monitors Strapi health and automatically restarts on failure
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Configuration
const CONFIG = {
  STRAPI_PORT: 1337,
  HEALTH_CHECK_INTERVAL: 30000, // Check every 30 seconds
  HEALTH_CHECK_TIMEOUT: 5000,
  MAX_RESTART_ATTEMPTS: 3,
  RESTART_DELAY: 5000,
  FAILURE_THRESHOLD: 3, // Consecutive failures before restart
};

// State tracking
let state = {
  strapiProcess: null,
  consecutiveFailures: 0,
  restartAttempts: 0,
  lastRestartTime: null,
  isRestarting: false,
  startTime: Date.now(),
};

/**
 * Check if Strapi is healthy
 */
const checkHealth = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: CONFIG.STRAPI_PORT,
      path: '/_health',
      method: 'GET',
      timeout: CONFIG.HEALTH_CHECK_TIMEOUT,
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404); // 404 is OK (endpoint might not exist)
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

/**
 * Start Strapi process
 */
const startStrapi = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Strapi backend...');
    
    const strapiProcess = spawn('npm', ['run', 'develop'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false,
    });

    state.strapiProcess = strapiProcess;
    state.startTime = Date.now();

    // Capture output
    strapiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started successfully')) {
        console.log('✅ Strapi started successfully');
        state.consecutiveFailures = 0;
        resolve();
      }
      // Log important messages
      if (output.includes('error') || output.includes('Error')) {
        console.error('⚠️ Strapi error:', output);
      }
    });

    strapiProcess.stderr.on('data', (data) => {
      console.error('❌ Strapi stderr:', data.toString());
    });

    strapiProcess.on('close', (code) => {
      console.log(`⚠️ Strapi process exited with code ${code}`);
      state.strapiProcess = null;
      
      if (!state.isRestarting && code !== 0) {
        handleCrash();
      }
    });

    // Timeout for startup
    setTimeout(() => {
      if (state.strapiProcess && !state.strapiProcess.killed) {
        resolve(); // Assume started even if we didn't see the message
      }
    }, 30000);
  });
};

/**
 * Stop Strapi process gracefully
 */
const stopStrapi = () => {
  return new Promise((resolve) => {
    if (!state.strapiProcess) {
      resolve();
      return;
    }

    console.log('🛑 Stopping Strapi...');
    
    state.strapiProcess.on('close', () => {
      state.strapiProcess = null;
      resolve();
    });

    // Try graceful shutdown first
    state.strapiProcess.kill('SIGTERM');

    // Force kill after 5 seconds
    setTimeout(() => {
      if (state.strapiProcess) {
        state.strapiProcess.kill('SIGKILL');
        state.strapiProcess = null;
        resolve();
      }
    }, 5000);
  });
};

/**
 * Restart Strapi
 */
const restartStrapi = async () => {
  if (state.isRestarting) {
    console.log('⏳ Restart already in progress...');
    return;
  }

  state.isRestarting = true;
  state.restartAttempts++;

  console.log(`🔄 Restarting Strapi (attempt ${state.restartAttempts}/${CONFIG.MAX_RESTART_ATTEMPTS})...`);

  try {
    await stopStrapi();
    await new Promise(resolve => setTimeout(resolve, CONFIG.RESTART_DELAY));
    await startStrapi();
    
    state.lastRestartTime = Date.now();
    state.isRestarting = false;
    
    console.log('✅ Strapi restarted successfully');
  } catch (error) {
    console.error('❌ Failed to restart Strapi:', error);
    state.isRestarting = false;

    if (state.restartAttempts >= CONFIG.MAX_RESTART_ATTEMPTS) {
      console.error('💀 Max restart attempts reached. Manual intervention required.');
      process.exit(1);
    } else {
      // Try again after delay
      setTimeout(restartStrapi, CONFIG.RESTART_DELAY * 2);
    }
  }
};

/**
 * Handle unexpected crash
 */
const handleCrash = async () => {
  console.error('💥 Strapi crashed unexpectedly!');
  
  // Wait a bit before restarting
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await restartStrapi();
};

/**
 * Health check loop
 */
const startHealthMonitoring = async () => {
  console.log('🏥 Starting health monitoring...');

  setInterval(async () => {
    // Skip if already restarting
    if (state.isRestarting) return;

    const isHealthy = await checkHealth();
    
    if (isHealthy) {
      if (state.consecutiveFailures > 0) {
        console.log('✅ Health check passed - backend recovered');
      }
      state.consecutiveFailures = 0;
      state.restartAttempts = 0; // Reset restart counter on success
    } else {
      state.consecutiveFailures++;
      console.warn(`⚠️ Health check failed (${state.consecutiveFailures}/${CONFIG.FAILURE_THRESHOLD})`);

      if (state.consecutiveFailures >= CONFIG.FAILURE_THRESHOLD) {
        console.error('🚨 Backend unhealthy - initiating restart...');
        await restartStrapi();
      }
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL);
};

/**
 * Get current status
 */
const getStatus = () => ({
  isRunning: state.strapiProcess !== null,
  consecutiveFailures: state.consecutiveFailures,
  restartAttempts: state.restartAttempts,
  lastRestartTime: state.lastRestartTime,
  uptime: state.startTime ? Date.now() - state.startTime : 0,
  isRestarting: state.isRestarting,
});

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await stopStrapi();
  process.exit(0);
};

// Handle termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Main execution
const main = async () => {
  console.log('🏥 Backend Health Monitor Starting...\n');
  
  try {
    await startStrapi();
    await startHealthMonitoring();
    
    console.log('\n✅ Health monitor active');
    console.log(`📊 Status endpoint: http://localhost:${CONFIG.STRAPI_PORT}`);
    console.log('   Press Ctrl+C to stop\n');
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
};

// Start if run directly
if (require.main === module) {
  main();
}

module.exports = {
  startStrapi,
  stopStrapi,
  restartStrapi,
  checkHealth,
  getStatus,
};
