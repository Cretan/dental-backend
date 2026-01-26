/**
 * Unit Tests: Validation Utilities
 *
 * Tests for validateCnp, validatePhone, validateEmail, calculateAge, validateFieldLengths.
 * No Strapi instance needed — pure functions.
 */

const {
  validateCnp,
  validatePhone,
  validateEmail,
  calculateAge,
  validateFieldLengths,
  MAX_LENGTHS,
} = require('../../src/utils/validators');

// =============================================================================
// validateCnp
// =============================================================================
describe('validateCnp', () => {
  // Valid CNPs (with correct checksum)
  test('accepts a valid male CNP', () => {
    // Weights: 2,7,9,1,4,6,3,5,8,2,7,9
    // 1900101040072: sum=167, 167%11=2, check=2
    expect(validateCnp('1900101040072')).toBe(true);
  });

  test('accepts a valid female CNP', () => {
    // 2850101040052: sum=189, 189%11=2, check=2
    expect(validateCnp('2850101040052')).toBe(true);
  });

  test('rejects null', () => {
    expect(validateCnp(null)).toBe(false);
  });

  test('rejects undefined', () => {
    expect(validateCnp(undefined)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(validateCnp('')).toBe(false);
  });

  test('rejects wrong length (12 digits)', () => {
    expect(validateCnp('190010104007')).toBe(false);
  });

  test('rejects wrong length (14 digits)', () => {
    expect(validateCnp('19001010400781')).toBe(false);
  });

  test('rejects non-numeric characters', () => {
    expect(validateCnp('190010104007a')).toBe(false);
  });

  test('rejects first digit 0', () => {
    expect(validateCnp('0900101040078')).toBe(false);
  });

  test('rejects first digit 9', () => {
    expect(validateCnp('9900101040078')).toBe(false);
  });

  test('rejects wrong checksum', () => {
    // 1900101040072 is valid (check=2), changing last digit to 9 invalidates it
    expect(validateCnp('1900101040079')).toBe(false);
  });

  test('handles checksum=10 edge case (should map to 1)', () => {
    // When sum % 11 === 10, expected checksum is 1
    // 1800101340151: sum=164, 164%11=10, expected=1, check=1
    expect(validateCnp('1800101340151')).toBe(true);
    // Verify wrong last digit fails
    expect(validateCnp('1800101340150')).toBe(false);
  });

  test('rejects CNP with spaces', () => {
    expect(validateCnp('1 900101040078')).toBe(false);
  });
});

// =============================================================================
// validatePhone
// =============================================================================
describe('validatePhone', () => {
  test('accepts +40 international format', () => {
    expect(validatePhone('+40712345678')).toBe(true);
  });

  test('accepts 07XX national format', () => {
    expect(validatePhone('0712345678')).toBe(true);
  });

  test('accepts phone with spaces', () => {
    expect(validatePhone('+40 712 345 678')).toBe(true);
  });

  test('accepts phone with hyphens', () => {
    expect(validatePhone('07-12-345-678')).toBe(true);
  });

  test('accepts phone with dots', () => {
    expect(validatePhone('07.12.345.678')).toBe(true);
  });

  test('rejects null', () => {
    expect(validatePhone(null)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(validatePhone('')).toBe(false);
  });

  test('rejects wrong prefix (not 07 or +407)', () => {
    expect(validatePhone('0612345678')).toBe(false);
  });

  test('rejects too short number', () => {
    expect(validatePhone('071234567')).toBe(false);
  });

  test('rejects too long number', () => {
    expect(validatePhone('07123456789')).toBe(false);
  });

  test('rejects landline (not mobile)', () => {
    expect(validatePhone('0212345678')).toBe(false);
  });

  test('rejects international non-Romanian', () => {
    expect(validatePhone('+33712345678')).toBe(false);
  });
});

// =============================================================================
// validateEmail
// =============================================================================
describe('validateEmail', () => {
  test('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  test('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  test('accepts email with plus sign', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  test('rejects null', () => {
    expect(validateEmail(null)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  test('rejects missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  test('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  test('rejects missing TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  test('rejects email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

// =============================================================================
// calculateAge
// =============================================================================
describe('calculateAge', () => {
  test('calculates age for a normal date', () => {
    const age = calculateAge('1990-01-01');
    const expectedYear = new Date().getFullYear() - 1990;
    // Could be expectedYear or expectedYear-1 depending on current month/day
    expect(age).toBeGreaterThanOrEqual(expectedYear - 1);
    expect(age).toBeLessThanOrEqual(expectedYear);
  });

  test('returns 0 for a baby born this year', () => {
    const today = new Date();
    const thisYear = today.getFullYear();
    // Born Jan 1 of this year
    const age = calculateAge(`${thisYear}-01-01`);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThanOrEqual(1);
  });

  test('returns negative for future date', () => {
    const futureYear = new Date().getFullYear() + 5;
    const age = calculateAge(`${futureYear}-06-15`);
    expect(age).toBeLessThan(0);
  });

  test('handles birthday today correctly', () => {
    const today = new Date();
    const yearStr = String(today.getFullYear() - 30);
    const monthStr = String(today.getMonth() + 1).padStart(2, '0');
    const dayStr = String(today.getDate()).padStart(2, '0');
    const age = calculateAge(`${yearStr}-${monthStr}-${dayStr}`);
    expect(age).toBe(30);
  });

  test('handles birthday tomorrow (not yet birthday)', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yearStr = String(tomorrow.getFullYear() - 25);
    const monthStr = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dayStr = String(tomorrow.getDate()).padStart(2, '0');
    const age = calculateAge(`${yearStr}-${monthStr}-${dayStr}`);
    expect(age).toBe(24);
  });

  test('calculates age over 100', () => {
    const age = calculateAge('1920-01-01');
    expect(age).toBeGreaterThanOrEqual(105);
  });
});

// =============================================================================
// validateFieldLengths
// =============================================================================
describe('validateFieldLengths', () => {
  test('returns null for valid data', () => {
    const result = validateFieldLengths({
      nume: 'Popescu',
      prenume: 'Ion',
      cnp: '1900101040078',
      telefon: '0712345678',
      email: 'ion@example.com',
    });
    expect(result).toBeNull();
  });

  test('returns null for empty data', () => {
    expect(validateFieldLengths({})).toBeNull();
  });

  test('returns error when nume exceeds 100 chars', () => {
    const result = validateFieldLengths({
      nume: 'a'.repeat(101),
    });
    expect(result).toBe('nume exceeds maximum length of 100 characters');
  });

  test('returns error when email exceeds 254 chars', () => {
    const result = validateFieldLengths({
      email: 'a'.repeat(255),
    });
    expect(result).toBe('email exceeds maximum length of 254 characters');
  });

  test('returns error when adresa exceeds 500 chars', () => {
    const result = validateFieldLengths({
      adresa: 'a'.repeat(501),
    });
    expect(result).toBe('adresa exceeds maximum length of 500 characters');
  });

  test('accepts fields at exact max length', () => {
    const result = validateFieldLengths({
      nume: 'a'.repeat(100),
      prenume: 'b'.repeat(100),
      cnp: '1'.repeat(13),
      telefon: '0'.repeat(20),
      email: 'e'.repeat(254),
      adresa: 'a'.repeat(500),
    });
    expect(result).toBeNull();
  });

  test('ignores non-string values', () => {
    const result = validateFieldLengths({
      nume: 12345,
      prenume: null,
    });
    expect(result).toBeNull();
  });

  test('ignores unknown fields', () => {
    const result = validateFieldLengths({
      randomField: 'a'.repeat(10000),
    });
    expect(result).toBeNull();
  });
});
