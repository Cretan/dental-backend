/**
 * pacient controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pacient.pacient', ({ strapi }) => ({
  /**
   * Create patient with validation
   */
  async create(ctx) {
    const { data } = ctx.request.body;
    
    // Validation: CNP (Romanian Personal Identification Number)
    if (!data.CNP || !validateCNP(data.CNP)) {
      return ctx.badRequest('CNP invalid. Must be 13 digits with valid checksum.');
    }
    
    // Validation: Phone (Romanian format)
    if (!data.telefon || !validatePhone(data.telefon)) {
      return ctx.badRequest('Phone number invalid. Use format: +40700000000 or 0700000000');
    }
    
    // Validation: Email (if provided)
    if (data.email && !validateEmail(data.email)) {
      return ctx.badRequest('Email invalid format');
    }
    
    // Validation: Birth date
    if (!data.data_nasterii) {
      return ctx.badRequest('Birth date is required');
    }
    
    const age = calculateAge(data.data_nasterii);
    if (age < 0 || age > 120) {
      return ctx.badRequest('Invalid birth date');
    }
    
    // Validation: Required fields
    if (!data.nume || !data.prenume) {
      return ctx.badRequest('Last name (nume) and first name (prenume) are required');
    }
    
    // All validations passed - create patient
    try {
      const response = await super.create(ctx);
      return response;
    } catch (error) {
      if (error.message.includes('unique')) {
        return ctx.badRequest('CNP already exists in database');
      }
      throw error;
    }
  },

  /**
   * Update patient with validation
   */
  async update(ctx) {
    const { data } = ctx.request.body;
    
    // Validate phone if provided
    if (data.telefon && !validatePhone(data.telefon)) {
      return ctx.badRequest('Phone number invalid');
    }
    
    // Validate email if provided
    if (data.email && !validateEmail(data.email)) {
      return ctx.badRequest('Email invalid format');
    }
    
    // Validate CNP if provided (can't change, but validate format)
    if (data.CNP && !validateCNP(data.CNP)) {
      return ctx.badRequest('CNP invalid format');
    }
    
    try {
      const response = await super.update(ctx);
      return response;
    } catch (error) {
      if (error.message.includes('unique')) {
        return ctx.badRequest('CNP or phone already exists');
      }
      throw error;
    }
  },

  /**
   * Advanced search across multiple fields
   */
  async search(ctx) {
    const { query } = ctx.request.query;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return ctx.badRequest('Search query parameter is required');
    }
    
    const searchTerm = query.trim();
    
    try {
      const results = await strapi.db.query('api::pacient.pacient').findMany({
        where: {
          $or: [
            { nume: { $containsi: searchTerm } },
            { prenume: { $containsi: searchTerm } },
            { CNP: { $containsi: searchTerm } },
            { telefon: { $containsi: searchTerm } },
            { email: { $containsi: searchTerm } },
          ],
        },
        orderBy: { nume: 'asc' },
        limit: 50,
        populate: {
          cabinet: {
            select: ['nume_cabinet'],
          },
        },
      });
      
      return results;
    } catch (error) {
      strapi.log.error('Search error:', error);
      return ctx.internalServerError('Search failed');
    }
  },

  /**
   * Get patient statistics
   */
  async statistics(ctx) {
    try {
      // Total count
      const totalPatients = await strapi.db.query('api::pacient.pacient').count();
      
      // Simple age distribution without complex SQL (fallback for safety)
      let ageDistribution = [];
      try {
        // Try raw SQL for better performance
        const ageGroups = await strapi.db.connection.raw(`
          SELECT 
            CASE 
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 18 THEN 'Under 18'
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 35 THEN '18-35'
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 50 THEN '35-50'
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 65 THEN '50-65'
              ELSE '65+'
            END as age_group,
            COUNT(*) as count
          FROM pacients
          WHERE data_nasterii IS NOT NULL
          GROUP BY age_group
          ORDER BY 
            CASE 
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 18 THEN 1
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 35 THEN 2
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 50 THEN 3
              WHEN EXTRACT(YEAR FROM AGE(data_nasterii)) < 65 THEN 4
              ELSE 5
            END
        `);
        ageDistribution = ageGroups.rows || [];
      } catch (sqlError) {
        strapi.log.warn('Raw SQL failed, using basic stats', sqlError);
        // Fallback: just return empty array if SQL fails
        ageDistribution = [];
      }
      
      // Cabinet statistics (optional, may fail if no cabinets)
      let byCabinet = [];
      try {
        const cabinetStats = await strapi.db.connection.raw(`
          SELECT 
            c.nume_cabinet,
            COUNT(p.id) as patient_count
          FROM cabinets c
          LEFT JOIN pacients_cabinet_lnk pcl ON c.id = pcl.cabinet_id
          LEFT JOIN pacients p ON pcl.pacient_id = p.id
          GROUP BY c.id, c.nume_cabinet
          ORDER BY patient_count DESC
        `);
        byCabinet = cabinetStats.rows || [];
      } catch (cabinetError) {
        strapi.log.warn('Cabinet stats failed', cabinetError);
        byCabinet = [];
      }
      
      return {
        total: totalPatients,
        ageDistribution,
        byCabinet,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      strapi.log.error('Statistics error:', error);
      return ctx.internalServerError('Failed to generate statistics');
    }
  },
}));

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

/**
 * Validate Romanian CNP (Cod Numeric Personal)
 * Format: 13 digits with checksum
 * Example: 1900101123456
 */
function validateCNP(cnp: string): boolean {
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
  const sum = cnp.split('').slice(0, 12).reduce((acc, digit, index) => {
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
function validatePhone(phone: string): boolean {
  if (!phone) return false;
  
  // Remove spaces, hyphens, dots
  const cleaned = phone.replace(/[\s\-\.]/g, '');
  
  // Romanian mobile: starts with +40 or 0, followed by 7XX
  const patterns = [
    /^\+407\d{8}$/,    // +40700000000
    /^07\d{8}$/,       // 0700000000
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
}

/**
 * Validate email format
 */
function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}
