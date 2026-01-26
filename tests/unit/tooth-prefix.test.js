/**
 * Unit Tests: Tooth Prefix Utilities
 *
 * Tests for addDintePrefix, removeDintePrefix,
 * transformTratamenteForDB, transformTratamenteForFrontend.
 * No Strapi instance needed — pure functions.
 */

const {
  addDintePrefix,
  removeDintePrefix,
  transformTratamenteForDB,
  transformTratamenteForFrontend,
} = require('../../src/utils/tooth-prefix');

// =============================================================================
// addDintePrefix
// =============================================================================
describe('addDintePrefix', () => {
  test('adds prefix to raw number', () => {
    expect(addDintePrefix('11')).toBe('dinte_11');
  });

  test('adds prefix to multi-digit number', () => {
    expect(addDintePrefix('48')).toBe('dinte_48');
  });

  test('returns as-is if already prefixed', () => {
    expect(addDintePrefix('dinte_11')).toBe('dinte_11');
  });

  test('returns null for null', () => {
    expect(addDintePrefix(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(addDintePrefix(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(addDintePrefix('')).toBeNull();
  });

  test('handles string with only prefix', () => {
    expect(addDintePrefix('dinte_')).toBe('dinte_');
  });
});

// =============================================================================
// removeDintePrefix
// =============================================================================
describe('removeDintePrefix', () => {
  test('removes prefix from prefixed value', () => {
    expect(removeDintePrefix('dinte_11')).toBe('11');
  });

  test('removes prefix from longer number', () => {
    expect(removeDintePrefix('dinte_48')).toBe('48');
  });

  test('returns as-is if not prefixed', () => {
    expect(removeDintePrefix('11')).toBe('11');
  });

  test('returns null for null', () => {
    expect(removeDintePrefix(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(removeDintePrefix(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(removeDintePrefix('')).toBeNull();
  });

  test('handles prefix-only string', () => {
    expect(removeDintePrefix('dinte_')).toBe('');
  });

  test('does not remove partial prefix', () => {
    expect(removeDintePrefix('dint_11')).toBe('dint_11');
  });
});

// =============================================================================
// transformTratamenteForDB
// =============================================================================
describe('transformTratamenteForDB', () => {
  test('transforms array of treatments', () => {
    const input = [
      { numar_dinte: '11', tip_procedura: 'Extractie', pret: 100 },
      { numar_dinte: '21', tip_procedura: 'Plomba', pret: 200 },
    ];
    const result = transformTratamenteForDB(input);
    expect(result[0].numar_dinte).toBe('dinte_11');
    expect(result[1].numar_dinte).toBe('dinte_21');
  });

  test('preserves other fields', () => {
    const input = [{ numar_dinte: '11', tip_procedura: 'Extractie', pret: 100 }];
    const result = transformTratamenteForDB(input);
    expect(result[0].tip_procedura).toBe('Extractie');
    expect(result[0].pret).toBe(100);
  });

  test('handles null numar_dinte', () => {
    const input = [{ numar_dinte: null, tip_procedura: 'Consultatie', pret: 50 }];
    const result = transformTratamenteForDB(input);
    expect(result[0].numar_dinte).toBeNull();
  });

  test('does not double-prefix already prefixed values', () => {
    const input = [{ numar_dinte: 'dinte_11', tip_procedura: 'Test', pret: 10 }];
    const result = transformTratamenteForDB(input);
    expect(result[0].numar_dinte).toBe('dinte_11');
  });

  test('handles empty array', () => {
    expect(transformTratamenteForDB([])).toEqual([]);
  });
});

// =============================================================================
// transformTratamenteForFrontend
// =============================================================================
describe('transformTratamenteForFrontend', () => {
  test('transforms array of treatments', () => {
    const input = [
      { numar_dinte: 'dinte_11', tip_procedura: 'Extractie', pret: 100 },
      { numar_dinte: 'dinte_21', tip_procedura: 'Plomba', pret: 200 },
    ];
    const result = transformTratamenteForFrontend(input);
    expect(result[0].numar_dinte).toBe('11');
    expect(result[1].numar_dinte).toBe('21');
  });

  test('preserves other fields', () => {
    const input = [{ numar_dinte: 'dinte_11', tip_procedura: 'Extractie', pret: 100 }];
    const result = transformTratamenteForFrontend(input);
    expect(result[0].tip_procedura).toBe('Extractie');
    expect(result[0].pret).toBe(100);
  });

  test('handles null numar_dinte', () => {
    const input = [{ numar_dinte: null, tip_procedura: 'Consultatie', pret: 50 }];
    const result = transformTratamenteForFrontend(input);
    expect(result[0].numar_dinte).toBeNull();
  });

  test('returns empty array for null input', () => {
    expect(transformTratamenteForFrontend(null)).toEqual([]);
  });

  test('returns empty array for undefined input', () => {
    expect(transformTratamenteForFrontend(undefined)).toEqual([]);
  });

  test('handles empty array', () => {
    expect(transformTratamenteForFrontend([])).toEqual([]);
  });

  test('round-trip: DB → Frontend → DB preserves values', () => {
    const original = [
      { numar_dinte: '11', tip_procedura: 'Test', pret: 100 },
    ];
    const toDB = transformTratamenteForDB(original);
    const toFrontend = transformTratamenteForFrontend(toDB);
    const backToDB = transformTratamenteForDB(toFrontend);

    expect(toFrontend[0].numar_dinte).toBe('11');
    expect(backToDB[0].numar_dinte).toBe('dinte_11');
  });
});
