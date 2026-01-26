/**
 * Validation Utilities
 *
 * Pure functions for validating patient data fields.
 * Extracted from pacient controller for testability and reuse.
 */

// Input length validation constants (prevent abuse)
export const MAX_LENGTHS: Record<string, number> = {
  nume: 100,
  prenume: 100,
  cnp: 13,
  telefon: 20,
  email: 254,
  adresa: 500,
};

/**
 * Validate input field lengths. Returns an error message if any field exceeds its limit.
 */
export function validateFieldLengths(data: Record<string, any>): string | null {
  for (const [field, maxLen] of Object.entries(MAX_LENGTHS)) {
    if (data[field] && typeof data[field] === 'string' && data[field].length > maxLen) {
      return `${field} exceeds maximum length of ${maxLen} characters`;
    }
  }
  return null;
}

/**
 * Validate Romanian CNP (Cod Numeric Personal)
 * Format: 13 digits with checksum
 * Example: 1900101123456
 */
export function validateCnp(cnp: string): boolean {
  // Must be exactly 13 digits
  if (!cnp || cnp.length !== 13) {
    return false;
  }

  // Must be all digits
  if (!/^\d{13}$/.test(cnp)) {
    return false;
  }

  // First digit: sex and century (1-8)
  const firstDigit = parseInt(cnp[0]);
  if (firstDigit < 1 || firstDigit > 8) {
    return false;
  }

  // Checksum validation (Romanian algorithm)
  const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
  const sum = cnp
    .split('')
    .slice(0, 12)
    .reduce((acc, digit, index) => {
      return acc + parseInt(digit) * weights[index];
    }, 0);

  const checksum = sum % 11;
  const expectedChecksum = checksum === 10 ? 1 : checksum;
  const actualChecksum = parseInt(cnp[12]);

  return expectedChecksum === actualChecksum;
}

/**
 * Validate Romanian phone number
 * Formats accepted:
 * - +40700000000 (international)
 * - 0700000000 (national)
 * - +40 700 000 000 (with spaces)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;

  // Remove spaces, hyphens, dots
  const cleaned = phone.replace(/[\s\-\.]/g, '');

  // Romanian mobile: starts with +40 or 0, followed by 7XX
  const patterns = [
    /^\+407\d{8}$/, // +40700000000
    /^07\d{8}$/, // 0700000000
  ];

  return patterns.some((pattern) => pattern.test(cleaned));
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
