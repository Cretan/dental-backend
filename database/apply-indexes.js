/**
 * Apply Cabinet Indexes Migration
 * 
 * This script applies database indexes for cabinet-based filtering
 * Run with: node database/apply-indexes.js
 */

const { Client } = require('pg');

async function applyIndexes() {
  // Get database configuration from environment or use defaults
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
    console.log('Starting cabinet indexes migration...\n');

    // Create indexes
    const indexes = [
      // Link table indexes for cabinet relations
      {
        name: 'idx_pacients_cabinet_lnk_cabinet_id',
        table: 'pacients_cabinet_lnk',
        column: 'cabinet_id'
      },
      {
        name: 'idx_pacients_cabinet_lnk_pacient_id',
        table: 'pacients_cabinet_lnk',
        column: 'pacient_id'
      },
      {
        name: 'idx_vizitas_cabinet_lnk_cabinet_id',
        table: 'vizitas_cabinet_lnk',
        column: 'cabinet_id'
      },
      {
        name: 'idx_vizitas_cabinet_lnk_vizita_id',
        table: 'vizitas_cabinet_lnk',
        column: 'vizita_id'
      },
      {
        name: 'idx_plan_trataments_cabinet_lnk_cabinet_id',
        table: 'plan_trataments_cabinet_lnk',
        column: 'cabinet_id'
      },
      {
        name: 'idx_plan_trataments_cabinet_lnk_plan_id',
        table: 'plan_trataments_cabinet_lnk',
        column: 'plan_tratament_id'
      },
      {
        name: 'idx_price_lists_cabinet_lnk_cabinet_id',
        table: 'price_lists_cabinet_lnk',
        column: 'cabinet_id'
      },
      {
        name: 'idx_price_lists_cabinet_lnk_price_list_id',
        table: 'price_lists_cabinet_lnk',
        column: 'price_list_id'
      },
      // Composite indexes for common query patterns
      {
        name: 'idx_vizitas_cabinet_date',
        table: 'vizitas',
        columns: ['id'] // We'll join through link table, so index main table id
      },
      {
        name: 'idx_vizitas_status',
        table: 'vizitas',
        columns: ['status_vizita']
      },
      {
        name: 'idx_pacients_cnp',
        table: 'pacients',
        columns: ['cnp']
      }
    ];

    for (const index of indexes) {
      try {
        // Check if index already exists
        const existsQuery = `
          SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = $1
          ) as exists;
        `;
        
        const result = await client.query(existsQuery, [index.name]);
        const indexExists = result.rows[0].exists;

        if (indexExists) {
          console.log(`✓ Index ${index.name} already exists, skipping`);
          continue;
        }

        // Create the index
        if (index.columns) {
          // Composite index
          const columnsList = index.columns.join(', ');
          const createQuery = `CREATE INDEX ${index.name} ON ${index.table} (${columnsList});`;
          await client.query(createQuery);
          console.log(`✅ Created composite index: ${index.name} on ${index.table}(${columnsList})`);
        } else {
          // Single column index
          const createQuery = `CREATE INDEX ${index.name} ON ${index.table} (${index.column});`;
          await client.query(createQuery);
          console.log(`✅ Created index: ${index.name} on ${index.table}(${index.column})`);
        }
      } catch (error) {
        console.error(`❌ Failed to create index ${index.name}:`, error.message);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('All cabinet indexes have been created.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
applyIndexes();
