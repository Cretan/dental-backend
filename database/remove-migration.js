/**
 * Remove Failed Migration from Database
 */

const { Client } = require('pg');

async function removeMigration() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'dental_db',
    user: process.env.DATABASE_USERNAME || 'dental_user',
    password: process.env.DATABASE_PASSWORD || 'dental_password',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!\n');

    // Check if migrations table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'strapi_migrations'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('No strapi_migrations table found');
      return;
    }

    // List current migrations
    console.log('Current migrations in database:');
    const migrations = await client.query('SELECT * FROM strapi_migrations ORDER BY time DESC LIMIT 10;');
    migrations.rows.forEach(m => {
      console.log(`  - ${m.name} (${m.time})`);
    });

    // Delete the problematic migration
    const migrationName = '2025-12-10-add-cabinet-indexes.js';
    const result = await client.query(
      'DELETE FROM strapi_migrations WHERE name = $1 RETURNING *;',
      [migrationName]
    );

    if (result.rowCount > 0) {
      console.log(`\n✅ Removed migration: ${migrationName}`);
    } else {
      console.log(`\n⚠️  Migration ${migrationName} not found in database`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

removeMigration();
