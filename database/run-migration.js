/**
 * Migration Runner
 * 
 * This script runs database migrations using Knex.js directly
 * Run with: node database/run-migration.js <migration-file-name>
 */

const path = require('path');
const fs = require('fs');

async function runMigration(migrationName) {
  // Get database configuration from environment
  const dbClient = process.env.DATABASE_CLIENT || 'postgres';
  
  if (dbClient !== 'postgres') {
    console.error('This migration is designed for PostgreSQL only');
    process.exit(1);
  }

  // Initialize Knex
  const knex = require('knex')({
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'strapi',
      user: process.env.DATABASE_USERNAME || 'strapi',
      password: process.env.DATABASE_PASSWORD || 'strapi',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }
  });

  try {
    console.log(`Running migration: ${migrationName}`);
    
    // Load migration file
    const migrationPath = path.join(__dirname, 'migrations', migrationName);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migration = require(migrationPath);
    
    // Run the up migration
    await migration.up(knex);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

// Get migration name from command line arguments
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: node database/run-migration.js <migration-file-name>');
  console.error('Example: node database/run-migration.js 2025-12-10-add-cabinet-indexes.js');
  process.exit(1);
}

runMigration(migrationName);
