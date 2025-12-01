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
const API_TOKEN = '11c77e75e59c95a7487a442d6df8c54727e674a2cb233ea37dc5ed3c51cfcf6588896d1b93161f658266768aa31240696f38a36d3ffa6989256b7b679c8bf7751b56dda969edb72e3d129ede081b914d789b34659d9c9fc3647111fd9d75ea3bbe3ee51a3aef3f0948549d37bed73c5569f00b277ab036af0aa1cafa42140379';
const HEADERS = { headers: { Authorization: `Bearer ${API_TOKEN}` } };

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

async function deleteSomePacients(limit = 100) {
    // 0. Publică toți pacienții (setează published_at)
    try {
      const { Client } = require('pg');
      const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'dental_db',
        user: 'dental_user',
        password: 'dental_password',
      });
      await client.connect();
      const res = await client.query("UPDATE pacients SET published_at = NOW() WHERE published_at IS NULL RETURNING id");
      log(`\n✓ Publicați ${res.rowCount} pacienți (setat published_at)`, 'green');
      await client.end();
    } catch (err) {
      log(`✗ Eroare la publicarea pacienților: ${err.message}`, 'red');
    }
  try {
    // 1. Afișează numărul total de pacienți înainte de ștergere
    const responseInitial = await axios.get(`${API_BASE}/pacients?pagination[limit]=100000`, { timeout: TIMEOUT, ...HEADERS });
    log('--- Răspuns complet de la GET /pacients:', 'blue');
    console.dir(responseInitial.data, { depth: 5 });
    if (!responseInitial.data || !Array.isArray(responseInitial.data.data)) {
      log('✗ Structura răspunsului nu este cea așteptată! responseInitial.data:', 'red');
      console.dir(responseInitial.data);
      return;
    }
    const entities = responseInitial.data.data;
    const totalInitial = entities.length;
    log(`\nNumăr total de pacienți înainte de ștergere: ${totalInitial}`, 'yellow');

    if (totalInitial === 0) {
      log(`  Nu există pacienți de șters.`, 'blue');
      return;
    }

    // 2. Șterge 100 de pacienți
    const toDelete = entities.slice(0, limit);
    let deleted = 0;
    let failed = 0;
    for (const entity of toDelete) {
      try {
        // GET înainte de DELETE
        let exists = false;
        try {
          const getResp = await axios.get(`${API_BASE}/pacients/${entity.id}`, { timeout: TIMEOUT, ...HEADERS });
          log(`    GET pacient ID ${entity.id}: status=${getResp.status}`, 'blue');
          console.dir(getResp.data, { depth: 5 });
          exists = getResp.status === 200 && getResp.data && getResp.data.data;
        } catch (getErr) {
          log(`    GET pacient ID ${entity.id} a eșuat: ${getErr.message}`, 'red');
        }

        const delResp = await axios.delete(`${API_BASE}/pacients/${entity.id}`, { timeout: TIMEOUT, ...HEADERS });
        log(`    Răspuns DELETE pentru pacient ID ${entity.id}: status=${delResp.status}`, 'blue');
        console.dir(delResp.data, { depth: 5 });
        if (delResp.status === 200 || delResp.status === 204) {
          deleted++;
          if (deleted % 10 === 0) {
            process.stdout.write(`\r  Stersi: ${deleted}/${toDelete.length}`);
          }
        } else {
          failed++;
          log(`  ✗ Stergere pacient ID ${entity.id} a returnat status ${delResp.status}`, 'red');
        }
      } catch (error) {
        failed++;
        log(`  ✗ Eroare la stergere pacient ID ${entity.id}: ${error.message}`, 'red');
      }
    }
    if (toDelete.length > 10) console.log('');
    log(`  ✓ Stersi ${deleted} pacienți${failed > 0 ? ` (${failed} esuați)` : ''}`, 'green');

    // 3. Afișează numărul total de pacienți după ștergere
    const responseFinal = await axios.get(`${API_BASE}/pacients?pagination[limit]=100000`, { timeout: TIMEOUT, ...HEADERS });
    const totalFinal = responseFinal.data.data.length;
    log(`Număr total de pacienți după ștergere: ${totalFinal}`, 'yellow');
    log(`Diferenta: ${totalInitial - totalFinal} pacienți șterși efectiv.`, 'blue');
  } catch (error) {
    log(`  ✗ Eroare generală: ${error.message}`, 'red');
  }
}

/**
 * Main cleanup function
 */


// Dacă se dă un ID ca argument, rulează GET și DELETE doar pentru acel ID
const pacientIdArg = process.argv[2] ? parseInt(process.argv[2], 10) : null;
if (pacientIdArg) {
  (async () => {
    try {
      // GET
      try {
        const getResp = await axios.get(`${API_BASE}/pacients/${pacientIdArg}`, { timeout: TIMEOUT, ...HEADERS });
        log(`GET pacient ID ${pacientIdArg}: status=${getResp.status}`, 'blue');
        console.dir(getResp.data, { depth: 5 });
      } catch (e) {
        log(`GET pacient ID ${pacientIdArg} a eșuat: ${e.response?.status} ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`, 'red');
      }
      // DELETE
      try {
        const delResp = await axios.delete(`${API_BASE}/pacients/${pacientIdArg}`, { timeout: TIMEOUT, ...HEADERS });
        log(`DELETE pacient ID ${pacientIdArg}: status=${delResp.status}`, 'blue');
        console.dir(delResp.data, { depth: 5 });
      } catch (e) {
        log(`DELETE pacient ID ${pacientIdArg} a eșuat: ${e.response?.status} ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`, 'red');
      }
    } catch (err) {
      log(`Eroare generală: ${err.message}`, 'red');
    }
  })();
} else {
  // Ruleaza stergerea a 100 de pacienti
  deleteSomePacients(100);
}
