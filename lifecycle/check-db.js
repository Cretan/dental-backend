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


    // Caută pacientul cu emailul specificat
    const emailToFind = 'alexandru.cretan@test.ro';
    try {
      const res = await client.query('SELECT * FROM pacients WHERE email = $1', [emailToFind]);
      if (res.rows.length > 0) {
        console.log(`❗ Pacient cu email ${emailToFind} EXISTĂ în baza de date. Detalii:`);
        console.dir(res.rows[0], { depth: 5 });
      } else {
        console.log(`✅ Pacient cu email ${emailToFind} NU există în baza de date.`);
      }
    } catch (err) {
      console.log(`Eroare la verificarea pacientului cu email ${emailToFind}:`, err.message);
    }
    console.log('');

    // Extrage structura tabelei pacients și verifică dacă toate câmpurile Strapi există
    try {
      const structRes = await client.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'pacients' ORDER BY ordinal_position;`);
      console.log('📐 Structura tabelei pacients:');
      console.log('==============================');
      structRes.rows.forEach(col => {
        console.log(`  ${col.column_name} | ${col.data_type} | nullable: ${col.is_nullable} | default: ${col.column_default}`);
      });
      console.log('');

      // Lista câmpurilor așteptate de Strapi (din schema.json)
      const expectedFields = [
        { name: 'id', type: 'integer' },
        { name: 'nume', type: 'character varying' },
        { name: 'prenume', type: 'character varying' },
        { name: 'cnp', type: 'character varying' },
        { name: 'data_nasterii', type: 'date' },
        { name: 'adresa', type: 'character varying' },
        { name: 'telefon', type: 'character varying' },
        { name: 'email', type: 'character varying' },
        { name: 'istoric_medical', type: 'jsonb' },
        { name: 'alergii', type: 'character varying' },
        { name: 'created_at', type: 'timestamp without time zone' },
        { name: 'updated_at', type: 'timestamp without time zone' },
        { name: 'published_at', type: 'timestamp without time zone' }
      ];

      // Normalizează structura DB pentru comparație
      const dbFields = structRes.rows.map(col => ({ name: col.column_name, type: col.data_type }));

      // Verifică lipsuri sau diferențe
      let allOk = true;
      for (const field of expectedFields) {
        const found = dbFields.find(f => f.name === field.name && f.type === field.type);
        if (!found) {
          allOk = false;
          const foundName = dbFields.find(f => f.name.toLowerCase() === field.name.toLowerCase());
          if (foundName) {
            console.log(`❗ Câmpul '${field.name}' există ca '${foundName.name}' dar cu tipul '${foundName.type}' (așteptat: '${field.type}') sau case greșit.`);
          } else {
            console.log(`❌ Câmpul '${field.name}' (${field.type}) LIPSEȘTE din tabelă!`);
          }
        }
      }
      if (allOk) {
        console.log('✅ Toate câmpurile așteptate de Strapi există cu nume și tip corect!');
      }
      console.log('');
    } catch (err) {
      console.log('❌ Eroare la extragerea/verificarea structurii tabelei pacients:', err.message);
    }


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

    // Check DELETE privilege for dental_user on pacients
    try {
      const priv = await client.query(`SELECT has_table_privilege('dental_user', 'pacients', 'DELETE') AS has_delete`);
      if (priv.rows.length > 0 && priv.rows[0].has_delete) {
        console.log('✅ User dental_user HAS DELETE privilege on table pacients.');
      } else {
        console.log('❌ User dental_user DOES NOT HAVE DELETE privilege on table pacients!');
      }
    } catch (err) {
      console.log('❌ Error checking DELETE privilege:', err.message);
    }

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
