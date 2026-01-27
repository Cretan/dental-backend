/**
 * Unit Tests: Audit Logger
 *
 * Tests for logAuditEvent utility.
 * Mocks the strapi global to verify behavior without a running instance.
 *
 * logAuditEvent uses setImmediate + transactionCtx.run for deadlock
 * prevention (see audit-logger.ts for details). Tests must:
 * 1. Mock @strapi/database/dist/transaction-context
 * 2. Flush the event loop after each call to let setImmediate fire
 */

// Mock the transaction context so setImmediate's callback can run
// without requiring a real Strapi database connection.
jest.mock('@strapi/database/dist/transaction-context', () => ({
  transactionCtx: {
    run: (_val, fn) => fn(),
  },
}));

const { logAuditEvent } = require('../../src/utils/audit-logger');

/**
 * Flush setImmediate queue and microtasks so the deferred audit
 * write completes before we assert on mock calls.
 */
function flushImmediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('logAuditEvent', () => {
  let mockStrapi;

  beforeEach(() => {
    mockStrapi = {
      documents: jest.fn().mockReturnValue({
        create: jest.fn().mockResolvedValue({ id: 1 }),
      }),
      log: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    };
  });

  test('creates audit log entry with correct fields', async () => {
    const entry = {
      actiune: 'Create',
      entitate: 'pacient',
      entitate_id: 'abc-123',
      date_vechi: null,
      date_noi: { nume: 'Popescu' },
      ip_address: '127.0.0.1',
      user: 1,
      cabinet: 2,
      detalii: 'Test audit',
    };

    logAuditEvent(mockStrapi, entry);
    await flushImmediate();

    expect(mockStrapi.documents).toHaveBeenCalledWith('api::audit-log.audit-log');
    const createCall = mockStrapi.documents().create;
    expect(createCall).toHaveBeenCalledWith({
      data: {
        actiune: 'Create',
        entitate: 'pacient',
        entitate_id: 'abc-123',
        date_vechi: null,
        date_noi: { nume: 'Popescu' },
        ip_address: '127.0.0.1',
        user: 1,
        cabinet: 2,
        detalii: 'Test audit',
      },
    });
  });

  test('handles missing optional fields gracefully', async () => {
    const entry = {
      actiune: 'Delete',
      entitate: 'vizita',
      entitate_id: '999',
    };

    logAuditEvent(mockStrapi, entry);
    await flushImmediate();

    const createCall = mockStrapi.documents().create;
    expect(createCall).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actiune: 'Delete',
        entitate: 'vizita',
        entitate_id: '999',
        date_vechi: null,
        date_noi: null,
        ip_address: null,
        user: null,
        cabinet: null,
        detalii: null,
      }),
    });
  });

  test('never throws on error (fire-and-forget)', async () => {
    mockStrapi.documents.mockReturnValue({
      create: jest.fn().mockRejectedValue(new Error('Database connection lost')),
    });

    const entry = {
      actiune: 'Create',
      entitate: 'pacient',
      entitate_id: '1',
    };

    // logAuditEvent returns void (fire-and-forget via setImmediate),
    // so calling it should never throw synchronously.
    expect(() => logAuditEvent(mockStrapi, entry)).not.toThrow();
    await flushImmediate();

    // Should log the error
    expect(mockStrapi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Audit log creation failed')
    );
  });

  test('logs error details on failure', async () => {
    mockStrapi.documents.mockReturnValue({
      create: jest.fn().mockRejectedValue(new Error('Constraint violation')),
    });

    logAuditEvent(mockStrapi, {
      actiune: 'Update',
      entitate: 'factura',
      entitate_id: '42',
    });
    await flushImmediate();

    expect(mockStrapi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Update on factura')
    );
    expect(mockStrapi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Constraint violation')
    );
  });

  test('handles all action types', async () => {
    const actions = ['Create', 'Update', 'Delete', 'View'];

    for (const actiune of actions) {
      logAuditEvent(mockStrapi, {
        actiune,
        entitate: 'pacient',
        entitate_id: '1',
      });
    }
    await flushImmediate();

    expect(mockStrapi.documents().create).toHaveBeenCalledTimes(actions.length);
  });
});
