/**
 * Database Cleanup Script
 * Deletes ALL data from the database
 * 
 * Usage: node tests/cleanup-database.js [--confirm]
 * 
 * WARNING: This will delete ALL patients, cabinets, visits, treatment plans, and price lists!
 */

const axios = require('axios');
const readline = require('readline');

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const API_BASE = `${STRAPI_URL}/api`;
const TIMEOUT = 30000;

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Ask user for confirmation
 */
function askConfirmation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Type "DELETE ALL" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'DELETE ALL');
    });
  });
}

/**
 * Delete all entities of a specific content type
 */
async function deleteAllEntities(contentType, displayName) {
  try {
    log(`\nDeleting all ${displayName}...`, 'yellow');
    
    // Fetch all entities (with high pagination limit)
    const response = await axios.get(`${API_BASE}/${contentType}?pagination[limit]=100000`, { 
      timeout: TIMEOUT 
    });
    
    const entities = response.data.data;
    const total = entities.length;
    
    if (total === 0) {
      log(`  No ${displayName} found`, 'blue');
      return 0;
    }
    
    log(`  Found ${total} ${displayName}`, 'blue');
    
    let deleted = 0;
    let failed = 0;
    
    for (const entity of entities) {
      try {
        await axios.delete(`${API_BASE}/${contentType}/${entity.id}`, { 
          timeout: TIMEOUT 
        });
        deleted++;
        
        // Progress indicator
        if (deleted % 100 === 0) {
          process.stdout.write(`\r  Deleted: ${deleted}/${total}`);
        }
      } catch (error) {
        failed++;
      }
    }
    
    if (total > 100) {
      console.log(''); // Newline after progress
    }
    
    log(`  ✓ Deleted ${deleted} ${displayName}${failed > 0 ? ` (${failed} failed)` : ''}`, 'green');
    return deleted;
    
  } catch (error) {
    log(`  ✗ Error deleting ${displayName}: ${error.message}`, 'red');
    return 0;
  }
}

/**
 * Main cleanup function
 */
async function cleanupDatabase() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              DATABASE CLEANUP UTILITY                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Check Strapi
    log('Checking Strapi connection...', 'yellow');
    await axios.get(`${STRAPI_URL}/_health`, { timeout: 5000 });
    log('✓ Strapi is running\n', 'green');
    
    // Check if --confirm flag is present
    const autoConfirm = process.argv.includes('--confirm');
    
    if (!autoConfirm) {
      log('⚠️  WARNING: This will delete ALL data from the database!', 'red');
      log('   - All patients', 'red');
      log('   - All cabinets', 'red');
      log('   - All visits', 'red');
      log('   - All treatment plans', 'red');
      log('   - All price lists', 'red');
      log('\n   This action CANNOT be undone!\n', 'bold');
      
      const confirmed = await askConfirmation();
      
      if (!confirmed) {
        log('\n✗ Cleanup cancelled\n', 'yellow');
        process.exit(0);
      }
    } else {
      log('Auto-confirm mode enabled. Proceeding with cleanup...\n', 'yellow');
    }
    
    log('\nStarting cleanup process...', 'blue');
    const startTime = Date.now();
    
    // Delete in correct order (respecting foreign key constraints)
    const stats = {
      visits: await deleteAllEntities('vizitas', 'visits'),
      plans: await deleteAllEntities('plan-trataments', 'treatment plans'),
      prices: await deleteAllEntities('price-lists', 'price lists'),
      patients: await deleteAllEntities('pacients', 'patients'),
      cabinets: await deleteAllEntities('cabinets', 'cabinets'),
      users: await deleteAllEntities('users', 'users (keep admin!)')
    };
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalDeleted = Object.values(stats).reduce((a, b) => a + b, 0);
    
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║                 CLEANUP COMPLETE! ✓                        ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝\n', 'green');
    
    log(`Summary:`, 'blue');
    log(`  Visits deleted:         ${stats.visits}`, 'green');
    log(`  Treatment plans deleted: ${stats.plans}`, 'green');
    log(`  Price lists deleted:    ${stats.prices}`, 'green');
    log(`  Patients deleted:       ${stats.patients}`, 'green');
    log(`  Cabinets deleted:       ${stats.cabinets}`, 'green');
    log(`  Users deleted:          ${stats.users}`, 'green');
    log(`  ─────────────────────────────`, 'blue');
    log(`  Total deleted:          ${totalDeleted}`, 'bold');
    log(`  Time taken:             ${totalTime}s\n`, 'blue');
    
    log('Database is now empty and ready for fresh data.\n', 'green');
    
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
cleanupDatabase();
