/**
 * Romanian CNP Generator and Validator
 * Generates valid CNPs with correct checksum according to Romanian standard
 */

/**
 * Calculate CNP checksum using Romanian algorithm
 * @param {string} cnp12 - First 12 digits of CNP
 * @returns {number} - Checksum digit (0-9)
 */
function calculateCNPChecksum(cnp12) {
  // Control string for CNP validation (Romanian standard)
  const controlString = '279146358279';
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnp12[i]) * parseInt(controlString[i]);
  }
  
  const remainder = sum % 11;
  return remainder === 10 ? 1 : remainder;
}

/**
 * Generate a valid CNP
 * @param {object} options - Generation options
 * @param {number} options.year - Birth year (1900-2099)
 * @param {number} options.month - Birth month (1-12)
 * @param {number} options.day - Birth day (1-31)
 * @param {string} options.gender - 'M' or 'F'
 * @param {number} options.county - County code (1-52)
 * @param {number} options.sequence - Sequence number (1-999)
 * @returns {string} - Valid 13-digit CNP
 */
function generateValidCNP(options = {}) {
  // Default values
  const year = options.year || 1990;
  const month = options.month || 1;
  const day = options.day || 1;
  const gender = options.gender || 'M';
  const county = options.county || 10; // Buzau
  const sequence = options.sequence || Math.floor(Math.random() * 900) + 100;
  
  // Determine S (first digit) based on century and gender
  let s;
  if (year >= 1900 && year <= 1999) {
    s = gender === 'M' ? 1 : 2;
  } else if (year >= 2000 && year <= 2099) {
    s = gender === 'M' ? 5 : 6;
  } else if (year >= 1800 && year <= 1899) {
    s = gender === 'M' ? 3 : 4;
  } else {
    throw new Error('Invalid year range');
  }
  
  // Format date components
  const yy = year.toString().slice(-2).padStart(2, '0');
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  const jj = county.toString().padStart(2, '0');
  const nnn = sequence.toString().padStart(3, '0');
  
  // Build first 12 digits
  const cnp12 = `${s}${yy}${mm}${dd}${jj}${nnn}`;
  
  // Calculate and append checksum
  const checksum = calculateCNPChecksum(cnp12);
  
  return `${cnp12}${checksum}`;
}

/**
 * Validate a CNP
 * @param {string} cnp - CNP to validate
 * @returns {boolean} - True if valid
 */
function validateCNP(cnp) {
  if (!cnp || cnp.length !== 13) {
    return false;
  }
  
  const cnp12 = cnp.slice(0, 12);
  const providedChecksum = parseInt(cnp[12]);
  const calculatedChecksum = calculateCNPChecksum(cnp12);
  
  return providedChecksum === calculatedChecksum;
}

/**
 * Generate multiple unique CNPs for testing
 * @param {number} count - Number of CNPs to generate
 * @returns {array} - Array of valid CNPs
 */
function generateTestCNPs(count = 3) {
  const cnps = [];
  const baseYear = 1985;
  
  for (let i = 0; i < count; i++) {
    const options = {
      year: baseYear + i,
      month: ((i * 3) % 12) + 1,
      day: ((i * 7) % 28) + 1,
      gender: i % 2 === 0 ? 'M' : 'F',
      county: 10 + (i % 10),
      sequence: 100 + i,
    };
    
    cnps.push(generateValidCNP(options));
  }
  
  return cnps;
}

module.exports = {
  generateValidCNP,
  validateCNP,
  calculateCNPChecksum,
  generateTestCNPs,
};

// If run directly, demonstrate usage
if (require.main === module) {
  console.log('Testing CNP Generator:\n');
  
  // Generate 5 test CNPs
  const testCNPs = generateTestCNPs(5);
  testCNPs.forEach((cnp, index) => {
    const isValid = validateCNP(cnp);
    console.log(`CNP ${index + 1}: ${cnp} - Valid: ${isValid ? '✓' : '✗'}`);
  });
  
  console.log('\nCustom CNP examples:');
  
  // Male born in 1990
  const cnp1 = generateValidCNP({ year: 1990, month: 5, day: 15, gender: 'M' });
  console.log(`Male 1990-05-15: ${cnp1} - Valid: ${validateCNP(cnp1) ? '✓' : '✗'}`);
  
  // Female born in 2000
  const cnp2 = generateValidCNP({ year: 2000, month: 12, day: 25, gender: 'F' });
  console.log(`Female 2000-12-25: ${cnp2} - Valid: ${validateCNP(cnp2) ? '✓' : '✗'}`);
}
