/**
 * Database Cleanup Script
 * Deletes ALL data from the database in correct order
 * 
 * ✨ NOW SUPPORTS INDEPENDENT EXECUTION ✨
 * Usage: node tests/cleanup-database.js
 * 
 * Order: Visits → Treatment Plans → Price Lists → Patients → Cabinets → Users
 * 
 * WARNING: This will delete ALL data!
 */

const axios = require('axios');
const StrapiLifecycle = require('./strapi-lifecycle');

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
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
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Delete all entities of a specific content type
 */
async function deleteAllEntities(endpoint, entityName) {
  try {
    log(`\nDeleting all ${entityName}...`, 'yellow');
    
    let totalDeleted = 0;
    let batchNumber = 0;
    const batchSize = 100;
    
    while (true) {
      batchNumber++;
      
      // Fetch a batch of entities
      const response = await axios.get(`${API_BASE}/${endpoint}?pagination[page]=1&pagination[pageSize]=${batchSize}`, getAuthConfig());
      
      if (!response.data || !response.data.data) {
        log(`✗ Invalid response structure for ${entityName}`, 'red');
        break;
      }
      
      const entities = response.data.data;
      
      if (entities.length === 0) {
        if (totalDeleted === 0) {
          log(`No ${entityName} to delete`, 'blue');
        }
        break;
      }
      
      if (batchNumber === 1) {
        const total = response.data.meta?.pagination?.total || entities.length;
        log(`Found ${total} ${entityName}, deleting in batches...`, 'blue');
      }
      
      // Delete batch
      let deleted = 0;
      let failed = 0;
      
      for (const entity of entities) {
        try {
          // Use documentId for Strapi v5
          const entityId = entity.documentId || entity.id;
          await axios.delete(`${API_BASE}/${endpoint}/${entityId}`, getAuthConfig());
          deleted++;
          totalDeleted++;
          
          if (totalDeleted % 50 === 0) {
            process.stdout.write(`\r  Deleted: ${totalDeleted}`);
          }
        } catch (error) {
          failed++;
          if (failed <= 3) {
            const entityId = entity.documentId || entity.id;
            log(`\n✗ Failed to delete ${entityName} ID ${entityId}: ${error.response?.data?.error?.message || error.message}`, 'red');
          }
        }
      }
      
      // If we couldn't delete any entities in this batch, stop to avoid infinite loop
      if (deleted === 0) {
        log(`\n⚠ Could not delete any entities in batch ${batchNumber}, stopping`, 'yellow');
        break;
      }
    }
    
    if (totalDeleted > 0) {
      console.log(''); // New line after progress
      log(`✓ Deleted ${totalDeleted} ${entityName}`, 'green');
    }
    
    return totalDeleted;
  } catch (error) {
    log(`✗ Error deleting ${entityName}: ${error.message}`, 'red');
    return 0;
  }
}

/**
 * Count entities in database
 */
async function countEntities() {
  const counts = {
    visits: 0,
    plans: 0,
    prices: 0,
    patients: 0,
    cabinets: 0,
    total: 0
  };
  
  try {
    const endpoints = [
      { key: 'visits', endpoint: 'vizitas' },
      { key: 'plans', endpoint: 'plan-trataments' },
      { key: 'prices', endpoint: 'price-lists' },
      { key: 'patients', endpoint: 'pacients' },
      { key: 'cabinets', endpoint: 'cabinets' }
    ];
    
    for (const { key, endpoint } of endpoints) {
      const response = await axios.get(`${API_BASE}/${endpoint}?pagination[limit]=1`, getAuthConfig());
      const count = response.data.meta?.pagination?.total || 0;
      counts[key] = count;
      counts.total += count;
    }
  } catch (error) {
    log(`⚠ Error counting entities: ${error.message}`, 'yellow');
  }
  
  return counts;
}

/**
 * Display entity counts
 */
function displayCounts(counts, label) {
  log(`\n${label}:`, 'cyan');
  log(`  Visits: ${counts.visits}`, 'gray');
  log(`  Treatment Plans: ${counts.plans}`, 'gray');
  log(`  Price Lists: ${counts.prices}`, 'gray');
  log(`  Patients: ${counts.patients}`, 'gray');
  log(`  Cabinets: ${counts.cabinets}`, 'gray');
  log(`  Total: ${counts.total}`, 'bold');
}

/**
 * Main cleanup function
 */
async function cleanupDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              DATABASE CLEANUP STARTED                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  let attempt = 0;
  const maxAttempts = 3;
  
  try {
    // Check Strapi connection
    log('Checking Strapi connection...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
    // Authenticate
    log('Authenticating...', 'yellow');
    const authenticated = await loginAndGetToken();
    if (!authenticated) {
      throw new Error('Authentication failed');
    }
    
    while (attempt < maxAttempts) {
      attempt++;
      
      if (attempt > 1) {
        log(`\n${'='.repeat(60)}`, 'yellow');
        log(`Cleanup Attempt ${attempt}/${maxAttempts}`, 'yellow');
        log('='.repeat(60), 'yellow');
      }
      
      // Count entities BEFORE cleanup
      log('\n📊 Counting entities before cleanup...', 'yellow');
      const beforeCounts = await countEntities();
      displayCounts(beforeCounts, '📋 Database state BEFORE cleanup');
      
      // If database is already empty, we're done
      if (beforeCounts.total === 0) {
        log('\n✓ Database is already empty!', 'green');
        break;
      }
      
      const startTime = Date.now();
      
      // Delete in correct order (respect foreign key constraints)
      let totalDeleted = 0;
      
      totalDeleted += await deleteAllEntities('vizitas', 'visits');
      totalDeleted += await deleteAllEntities('plan-trataments', 'treatment plans');
      totalDeleted += await deleteAllEntities('price-lists', 'price lists');
      totalDeleted += await deleteAllEntities('pacients', 'patients');
      totalDeleted += await deleteAllEntities('cabinets', 'cabinets');
      
      // Count entities AFTER cleanup
      log('\n📊 Counting entities after cleanup...', 'yellow');
      const afterCounts = await countEntities();
      displayCounts(afterCounts, '📋 Database state AFTER cleanup');
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      // Verify cleanup was successful
      if (afterCounts.total === 0) {
        log('\nℹ Users are not deleted (needed for authentication)', 'cyan');
        
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║              CLEANUP COMPLETE! ✓                          ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        log(`✓ Total entities deleted: ${totalDeleted}`, 'green');
        log(`⏱  Time: ${elapsed}s`, 'cyan');
        log(`✓ Database is now empty\n`, 'green');
        break;
      } else {
        log(`\n⚠ Warning: ${afterCounts.total} entities still remain in database`, 'yellow');
        log(`  Before: ${beforeCounts.total} | After: ${afterCounts.total} | Deleted: ${totalDeleted}`, 'yellow');
        
        if (attempt < maxAttempts) {
          log(`\n🔄 Retrying cleanup (attempt ${attempt + 1}/${maxAttempts})...`, 'yellow');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        } else {
          log(`\n✗ Failed to clean database after ${maxAttempts} attempts`, 'red');
          log(`  ${afterCounts.total} entities still remain`, 'red');
          process.exit(1);
        }
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('\n✗ Strapi is not running or not reachable.', 'red');
      log('  Please start the backend with: npm run develop\n', 'yellow');
    } else {
      log(`\n✗ Error: ${error.message}`, 'red');
    }
    process.exit(1);
  }
}

// Run cleanup
(async () => {
  const lifecycle = new StrapiLifecycle();
  
  try {
    // Ensure Strapi is running
    await lifecycle.ensureStrapiRunning();
    
    // Run cleanup
    await cleanupDatabase();
    
    // Cleanup Strapi lifecycle
    await lifecycle.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await lifecycle.cleanup();
    process.exit(1);
  }
})();
