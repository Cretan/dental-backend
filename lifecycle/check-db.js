const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'dental_db',
  user: 'dental_user',
  password: 'dental_password',
});

async function checkDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL!\n');

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Tables in database:');
    console.log('=====================');
    tablesResult.rows.forEach(row => console.log(`  - ${row.table_name}`));
    console.log('');

    // Count records in main tables
    const tables = ['pacients', 'cabinets', 'vizitas', 'plan_trataments', 'up_users'];
    
    console.log('📊 Record counts:');
    console.log('=================');
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ${table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`  ${table}: table not found or error`);
      }
    }

    // Show sample data from pacients if exists
    try {
      const patientsResult = await client.query('SELECT * FROM pacients LIMIT 5');
      if (patientsResult.rows.length > 0) {
        console.log('\n👤 Sample Patients:');
        console.log('===================');
        patientsResult.rows.forEach(patient => {
          console.log(`  ID: ${patient.id} | Name: ${patient.nume} ${patient.prenume} | Phone: ${patient.telefon}`);
        });
      }
    } catch (err) {
      // Table might not exist yet
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
