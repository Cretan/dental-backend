/**
 * Strapi Lifecycle Management Module
 * 
 * Provides reusable functions for managing Strapi lifecycle in test files:
 * - Check if Strapi is already running
 * - Start Strapi if needed
 * - Stop Strapi if started by this test
 * - Wait for Strapi to be ready
 * 
 * Usage:
 *   const StrapiLifecycle = require('./strapi-lifecycle');
 *   const lifecycle = new StrapiLifecycle();
 *   
 *   // At start of test file
 *   await lifecycle.ensureStrapiRunning();
 *   
 *   // At end of test file
 *   await lifecycle.cleanup();
 */

const { spawn, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const net = require('net');

// Configuration
const CONFIG = {
  STRAPI_PORT: 1337,
  STRAPI_URL: 'http://localhost:1337',
  STARTUP_TIMEOUT: 60000, // 60 seconds
  SHUTDOWN_TIMEOUT: 10000, // 10 seconds
  HEALTH_CHECK_INTERVAL: 2000, // 2 seconds
  HEALTH_CHECK_RETRIES: 3,
};

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

class StrapiLifecycle {
  constructor(options = {}) {
    this.config = { ...CONFIG, ...options };
    this.strapiProcess = null;
    this.startedByThisInstance = false;
    this.isShuttingDown = false;
  }

  /**
   * Log message with color
   */
  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Check if a port is free
   */
  async checkPortFree(port) {
    return new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .once('listening', () => {
          tester.once('close', () => resolve(true)).close();
        })
        .listen(port);
    });
  }

  /**
   * Kill process on specific port (Windows)
   */
  async killProcessOnPort(port) {
    try {
      this.log(`⚠️  Port ${port} is in use. Attempting to free it...`, 'yellow');
      
      if (process.platform === 'win32') {
        execSync(
          `powershell -Command "Get-Process -Id (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess | Stop-Process -Force"`,
          { stdio: 'ignore' }
        );
      } else {
        // Unix-like systems
        execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
      }
      
      this.log(`✓ Port ${port} has been freed.`, 'green');
      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } catch (error) {
      this.log(`⚠️  Could not free port ${port}: ${error.message}`, 'yellow');
      return false;
    }
  }

  /**
   * Check if Strapi is responding to health checks
   */
  async checkStrapiHealth() {
    try {
      // Try health endpoint first
      await axios.get(`${this.config.STRAPI_URL}/_health`, { 
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      return true;
    } catch (error) {
      // Try API endpoint as fallback
      try {
        await axios.get(`${this.config.STRAPI_URL}/api/pacients?pagination[limit]=1`, { 
          timeout: 5000,
          validateStatus: (status) => status < 500 // Accept even 401/403
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Wait for Strapi to be ready with retries
   */
  async waitForStrapi() {
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < this.config.STARTUP_TIMEOUT) {
      attempts++;
      const isHealthy = await this.checkStrapiHealth();
      
      if (isHealthy) {
        this.log(`✓ Strapi is ready (attempt ${attempts})`, 'green');
        return true;
      }
      
      // Log progress every few attempts
      if (attempts % 5 === 0) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        this.log(`⏳ Still waiting for Strapi... (${elapsed}s elapsed)`, 'gray');
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, this.config.HEALTH_CHECK_INTERVAL));
    }
    
    return false;
  }

  /**
   * Start Strapi process
   */
  async startStrapi() {
    return new Promise((resolve, reject) => {
      this.log('🚀 Starting Strapi backend...', 'cyan');
      
      const backendPath = path.join(__dirname, '..');
      
      this.strapiProcess = spawn('npm', ['run', 'develop'], {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let startupComplete = false;

      // Capture output to detect when Strapi is ready
      this.strapiProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Detect successful startup
        if (output.includes('started successfully') || output.includes('Server started')) {
          if (!startupComplete) {
            startupComplete = true;
            this.log('✓ Strapi startup detected', 'green');
            resolve();
          }
        }
      });

      this.strapiProcess.stderr.on('data', (data) => {
        const output = data.toString();
        // Only log actual errors
        if (output.includes('Error:') && !output.includes('warn')) {
          this.log(`⚠️  Strapi stderr: ${output.trim()}`, 'yellow');
        }
      });

      this.strapiProcess.on('close', (code) => {
        if (!this.isShuttingDown && code !== 0) {
          this.log(`❌ Strapi exited unexpectedly with code ${code}`, 'red');
          if (!startupComplete) {
            reject(new Error(`Strapi process exited with code ${code}`));
          }
        }
      });

      this.strapiProcess.on('error', (error) => {
        this.log(`❌ Failed to start Strapi: ${error.message}`, 'red');
        reject(error);
      });

      // Timeout fallback
      setTimeout(() => {
        if (!startupComplete) {
          this.log('⏳ Startup timeout reached, proceeding to health check...', 'yellow');
          resolve();
        }
      }, 30000);
    });
  }

  /**
   * Stop Strapi process
   */
  async stopStrapi() {
    if (!this.strapiProcess) {
      return;
    }

    return new Promise((resolve) => {
      this.isShuttingDown = true;
      this.log('🛑 Stopping Strapi...', 'yellow');

      this.strapiProcess.on('close', () => {
        this.strapiProcess = null;
        this.log('✓ Strapi stopped', 'gray');
        resolve();
      });

      // Try graceful shutdown first
      this.strapiProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.strapiProcess) {
          this.strapiProcess.kill('SIGKILL');
          this.strapiProcess = null;
          resolve();
        }
      }, this.config.SHUTDOWN_TIMEOUT);
    });
  }

  /**
   * Ensure Strapi is running (start if not already running)
   * This is the main method test files should call
   */
  async ensureStrapiRunning() {
    this.log('\n═══════════════════════════════════════════════════════', 'cyan');
    this.log('  Strapi Lifecycle: Checking Status', 'cyan');
    this.log('═══════════════════════════════════════════════════════\n', 'cyan');

    // Step 1: Check if Strapi is already running and healthy
    this.log('📡 Checking if Strapi is already running...', 'cyan');
    const isAlreadyRunning = await this.checkStrapiHealth();
    
    if (isAlreadyRunning) {
      this.log('✓ Strapi is already running and healthy!', 'green');
      this.log('ℹ️  Will NOT stop Strapi at cleanup (not started by this test)', 'gray');
      this.startedByThisInstance = false;
      return true;
    }

    this.log('⚠️  Strapi is not running or not responding', 'yellow');

    // Step 2: Check if port is free
    const isPortFree = await this.checkPortFree(this.config.STRAPI_PORT);
    
    if (!isPortFree) {
      // Try to kill the process on that port
      await this.killProcessOnPort(this.config.STRAPI_PORT);
    }

    // Step 3: Start Strapi
    this.log('🚀 Starting Strapi (will be stopped at cleanup)...', 'cyan');
    await this.startStrapi();
    
    // Step 4: Wait for Strapi to be ready
    this.log('⏳ Waiting for Strapi to be ready...', 'yellow');
    const isReady = await this.waitForStrapi();
    
    if (!isReady) {
      throw new Error('Strapi failed to start within timeout period');
    }
    
    this.startedByThisInstance = true;
    this.log('✓ Strapi is ready for testing!\n', 'green');
    return true;
  }

  /**
   * Cleanup: stop Strapi only if we started it
   */
  async cleanup() {
    if (this.startedByThisInstance) {
      this.log('\n🧹 Cleanup: Stopping Strapi (started by this test)...', 'yellow');
      await this.stopStrapi();
    } else {
      this.log('\n✓ Cleanup: Strapi left running (not started by this test)', 'gray');
    }
  }

  /**
   * Get Strapi URL
   */
  getStrapiUrl() {
    return this.config.STRAPI_URL;
  }
}

module.exports = StrapiLifecycle;
