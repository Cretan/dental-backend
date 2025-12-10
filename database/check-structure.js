/**
 * Check Table Structure
 * 
 * This script checks the actual structure of tables to find cabinet relation columns
 */

const { Client } = require('pg');

async function checkStructure() {
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

    const tables = [
      'pacients', 
      'vizitas', 
      'plan_trataments', 
      'price_lists', 
      'cabinets',
      'pacients_cabinet_lnk',
      'vizitas_cabinet_lnk',
      'plan_trataments_cabinet_lnk',
      'price_lists_cabinet_lnk'
    ];

    for (const table of tables) {
      console.log(`\n📋 Structure of ${table}:`);
      console.log('='.repeat(50));
      
      try {
        const result = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [table]);

        if (result.rows.length === 0) {
          console.log(`  Table ${table} does not exist`);
        } else {
          result.rows.forEach(col => {
            console.log(`  ${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | nullable: ${col.is_nullable}`);
          });
        }
      } catch (error) {
        console.error(`  ❌ Error querying ${table}:`, error.message);
      }
    }

    // Check for foreign key relationships
    console.log(`\n\n🔗 Foreign Key Relationships:`);
    console.log('='.repeat(50));
    
    const fkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'cabinets'
      ORDER BY tc.table_name;
    `;
    
    const fkResult = await client.query(fkQuery);
    
    if (fkResult.rows.length === 0) {
      console.log('  No foreign keys found to cabinets table');
    } else {
      fkResult.rows.forEach(fk => {
        console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkStructure();
