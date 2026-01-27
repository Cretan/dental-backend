/**
 * Strapi Test Instance Helper
 *
 * Boots a real Strapi instance with SQLite for integration tests.
 * Based on official Strapi v5 testing docs.
 *
 * Usage:
 *   const { setupStrapi, cleanupStrapi } = require('./helpers/strapi');
 *   beforeAll(async () => { await setupStrapi(); }, 60000);
 *   afterAll(async () => { await cleanupStrapi(); });
 *   // `strapi` is available as a global after setup
 */

const fs = require('fs');
const path = require('path');

let instance;

const appDir = path.resolve(__dirname, '..', '..');
const distDir = path.join(appDir, 'dist');

/**
 * Boot a Strapi instance for testing.
 * Uses a file-based SQLite database (cleaned up after tests).
 * Requires `npm run build` to have been run first (uses dist/).
 */
async function setupStrapi() {
  if (instance) {
    return instance;
  }

  // Force test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_CLIENT = 'sqlite';
  process.env.DATABASE_FILENAME = '.tmp/test.db';
  process.env.STRAPI_DISABLE_AUTO_RELOAD = 'true';
  // Use test secrets
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret';
  process.env.APP_KEYS = 'testkey1,testkey2,testkey3,testkey4';
  process.env.API_TOKEN_SALT = 'test-api-token-salt';
  process.env.TRANSFER_TOKEN_SALT = 'test-transfer-token-salt';

  // Pre-configure SQLite with WAL mode before Strapi opens the database.
  // WAL mode allows concurrent readers + one writer, preventing deadlocks
  // when Strapi's Document Service uses multiple pool connections.
  // Must be set BEFORE Strapi loads because:
  // - Setting WAL in pool.afterCreate causes "database is locked" during bootstrap
  //   (bootstrap does parallel inserts which conflict with the PRAGMA)
  // - Setting WAL after load is too late (connections are already open in DELETE mode)
  // - Setting WAL on the file itself before any connections open works cleanly
  const dbFilename = process.env.DATABASE_FILENAME || '.tmp/test.db';
  const dbPath = path.join(appDir, dbFilename);
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.close();
  } catch (_) {
    // better-sqlite3 not available or db path issue — skip
  }

  // Strapi v5: use the named export createStrapi
  const { createStrapi } = require('@strapi/strapi');

  await createStrapi({ appDir, distDir }).load();
  instance = strapi; // Strapi sets global.strapi during load()

  await instance.server.mount();

  // Increase SQLite pool max AFTER bootstrap to prevent DS update deadlocks.
  // Strapi's Document Service wraps updates in transactions that hold the
  // only pool connection. Concurrent queries (from AsyncLocalStorage context
  // loss in Strapi internals) need a second connection. We can't set max>1
  // BEFORE bootstrap because Strapi's syncPermissions does parallel inserts
  // that cause "database is locked" with multiple connections. Increasing
  // pool.max after bootstrap is safe because the schema is already created.
  try {
    const pool = strapi.db.connection.client.pool;
    if (pool && typeof pool.max !== 'undefined') {
      pool.max = 4;
    }
  } catch (_) { /* ignore if pool config not accessible */ }

  // Debug: patch pool to log acquisitions and releases during tests
  if (process.env.DEBUG_POOL) {
    const pool = strapi.db.connection.client.pool;
    const origAcquire = pool.acquire.bind(pool);
    const origRelease = pool.release.bind(pool);
    let acqCount = 0;
    let relCount = 0;

    pool.acquire = function() {
      acqCount++;
      const id = acqCount;
      const free = pool.numFree();
      const used = pool.numUsed();
      const pending = pool.numPendingAcquires();
      // Log acquisitions near the deadlock zone with full stacks
      if (acqCount > 310) {
        const stack = new Error().stack.split('\n').slice(1, 15).map(l => l.trim()).join('\n    ');
        console.log(`[POOL] ACQ #${id} free=${free} used=${used} pending=${pending}\n    ${stack}`);
      }
      const result = origAcquire.call(pool);
      if (result && result.promise) {
        result.promise.then(() => {
          if (acqCount > 310) {
            console.log(`[POOL] GOT #${id} free=${pool.numFree()} used=${pool.numUsed()}`);
          }
        }).catch((err) => {
          console.log(`[POOL] FAIL #${id}: ${err.message}`);
        });
      }
      return result;
    };

    pool.release = function(resource) {
      relCount++;
      const id = relCount;
      const free = pool.numFree();
      const used = pool.numUsed();
      // Log releases in the deadlock zone
      if (acqCount > 310) {
        const stack = new Error().stack.split('\n').slice(1, 10).map(l => l.trim()).join('\n    ');
        console.log(`[POOL] REL #${id} free=${free} used=${used} (acq=${acqCount})\n    ${stack}`);
      }
      return origRelease(resource);
    };
  }

  return instance;
}

/**
 * Tear down the Strapi instance and clean up the test database.
 *
 * Handles a known teardown race condition:
 * When strapi.destroy() tears down the tarn connection pool, pending
 * operations are aborted. If node-schedule has scheduled cron jobs,
 * the abort error propagates to Job.emit('error') with no listener,
 * crashing the process with ERR_UNHANDLED_ERROR. Cancelling all
 * node-schedule jobs and attaching no-op error handlers before
 * destroying prevents this.
 */
async function cleanupStrapi() {
  if (!instance) return;

  const dbSettings = strapi.config.get('database.connection');

  // Cancel all node-schedule cron jobs before destroying Strapi.
  // Strapi's cron system uses node-schedule internally. During pool
  // teardown, tarn aborts pending operations which triggers unhandled
  // error events on Job instances. Adding a no-op error handler and
  // cancelling the jobs prevents the ERR_UNHANDLED_ERROR crash.
  try {
    const schedule = require('node-schedule');
    for (const job of Object.values(schedule.scheduledJobs)) {
      job.on('error', () => {}); // Swallow errors during teardown
      job.cancel();
    }
  } catch (_) { /* node-schedule may not be available */ }

  // Use Strapi's built-in destroy method (handles server + db + pool cleanup)
  try {
    await strapi.destroy();
  } catch (e) {
    // Fallback: try manual cleanup if destroy fails
    try { await strapi.server.httpServer.close(); } catch (_) { /* ignore */ }
    try { await strapi.db.connection.destroy(); } catch (_) { /* ignore */ }
  }

  // Delete test database file and WAL-mode sidecar files (.db-wal, .db-shm).
  // On Windows, file handles may linger briefly after pool destroy — retry with delay.
  if (dbSettings && dbSettings.connection && dbSettings.connection.filename) {
    const tmpDbFile = dbSettings.connection.filename;
    const filesToDelete = [tmpDbFile, `${tmpDbFile}-wal`, `${tmpDbFile}-shm`];

    // Small delay for Windows to release file handles after pool destroy
    await new Promise((resolve) => setTimeout(resolve, 100));

    for (const f of filesToDelete) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) { /* ignore — file may already be gone */ }
    }
  }

  // Clear references so the next test file can boot a fresh instance
  instance = null;
  delete global.strapi;
}

module.exports = {
  setupStrapi,
  cleanupStrapi,
};
