/**
 * Unit Tests: Audit Logger
 *
 * Tests for logAuditEvent utility.
 * Mocks the strapi global to verify behavior without a running instance.
 */

const { logAuditEvent } = require('../../src/utils/audit-logger');

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

    await logAuditEvent(mockStrapi, entry);

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

    await logAuditEvent(mockStrapi, entry);

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

    // Should not throw
    await expect(logAuditEvent(mockStrapi, entry)).resolves.toBeUndefined();

    // Should log the error
    expect(mockStrapi.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Audit log creation failed')
    );
  });

  test('logs error details on failure', async () => {
    mockStrapi.documents.mockReturnValue({
      create: jest.fn().mockRejectedValue(new Error('Constraint violation')),
    });

    await logAuditEvent(mockStrapi, {
      actiune: 'Update',
      entitate: 'factura',
      entitate_id: '42',
    });

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
      await logAuditEvent(mockStrapi, {
        actiune,
        entitate: 'pacient',
        entitate_id: '1',
      });
    }

    expect(mockStrapi.documents().create).toHaveBeenCalledTimes(actions.length);
  });
});
