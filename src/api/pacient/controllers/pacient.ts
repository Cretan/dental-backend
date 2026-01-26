/**
 * pacient controller
 */

import { factories } from '@strapi/strapi';
import { validateFieldLengths, validateCnp, validatePhone, validateEmail, calculateAge } from '../../../utils/validators';

export default factories.createCoreController('api::pacient.pacient', ({ strapi }) => ({
    /**
     * Log and delete patient
     */
    async delete(ctx) {
      strapi.log.info(`[PACIENT DELETE] Cerere DELETE pentru pacient ID: ${ctx.params.id}`);
      try {
        const result = await super.delete(ctx);
        strapi.log.info(`[PACIENT DELETE] Patient deleted successfully`);
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        strapi.log.error(`[PACIENT DELETE] Eroare la ștergere pacient ID ${ctx.params.id}: ${message}`);
        throw error;
      }
    },
  /**
   * Create patient with validation
   */
  async create(ctx) {
    const { data } = ctx.request.body;

    strapi.log.info(`[PACIENT CREATE] Starting patient creation...`);
    strapi.log.info(`[PACIENT CREATE] Request data:`, JSON.stringify(data, null, 2));
    strapi.log.info(`[PACIENT CREATE] User ID: ${ctx.state.user?.id}`);
    strapi.log.info(`[PACIENT CREATE] User cabinet: ${ctx.state.user?.cabinet}`);

    // Input length validation (prevent abuse)
    const lengthError = validateFieldLengths(data);
    if (lengthError) {
      return ctx.badRequest(lengthError);
    }

    // Validation: cnp (Romanian Personal Identification Number)
    if (!data.cnp || !validateCnp(data.cnp)) {
      strapi.log.error(`[PACIENT CREATE] cnp validation failed: ${data.cnp}`);
      return ctx.badRequest('cnp invalid. Must be 13 digits with valid checksum.');
    }

    // Validation: Phone (Romanian format)
    if (!data.telefon || !validatePhone(data.telefon)) {
      strapi.log.error(`[PACIENT CREATE] Phone validation failed: ${data.telefon}`);
      return ctx.badRequest('Phone number invalid. Use format: +40700000000 or 0700000000');
    }

    // Validation: Email (if provided)
    if (data.email && !validateEmail(data.email)) {
      strapi.log.error(`[PACIENT CREATE] Email validation failed: ${data.email}`);
      return ctx.badRequest('Email invalid format');
    }

    // Validation: Birth date
    if (!data.data_nasterii) {
      strapi.log.error(`[PACIENT CREATE] Birth date missing`);
      return ctx.badRequest('Birth date is required');
    }

    const age = calculateAge(data.data_nasterii);
    if (age < 0 || age > 120) {
      strapi.log.error(`[PACIENT CREATE] Invalid age: ${age}`);
      return ctx.badRequest('Invalid birth date');
    }

    // Validation: Required fields
    if (!data.nume || !data.prenume) {
      strapi.log.error(`[PACIENT CREATE] Required fields missing: nume=${data.nume}, prenume=${data.prenume}`);
      return ctx.badRequest('Last name (nume) and first name (prenume) are required');
    }

    // All validations passed - create patient
    try {
      strapi.log.info(`[PACIENT CREATE] All validations passed, creating patient...`);
      const response = await super.create(ctx);
      strapi.log.info(`[PACIENT CREATE] SUCCESS! Patient created with ID: ${response.data.id}`);
      strapi.log.info(`[PACIENT CREATE] Created patient:`, JSON.stringify(response.data, null, 2));
      return response;
    } catch (error: unknown) {
      strapi.log.error(`[PACIENT CREATE] DATABASE ERROR:`, error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('unique')) {
        strapi.log.error(`[PACIENT CREATE] cnp already exists: ${data.cnp}`);
        return ctx.badRequest('cnp already exists in database');
      }
      throw error;
    }
  },

  /**
   * Update patient with validation
   */
  async update(ctx) {
    const { data } = ctx.request.body;

    // Input length validation (prevent abuse)
    const lengthError = validateFieldLengths(data);
    if (lengthError) {
      return ctx.badRequest(lengthError);
    }

    // Validate phone if provided
    if (data.telefon && !validatePhone(data.telefon)) {
      return ctx.badRequest('Phone number invalid');
    }

    // Validate email if provided
    if (data.email && !validateEmail(data.email)) {
      return ctx.badRequest('Email invalid format');
    }

    // Validate cnp if provided (can't change, but validate format)
    if (data.cnp && !validateCnp(data.cnp)) {
      return ctx.badRequest('cnp invalid format');
    }

    try {
      const response = await super.update(ctx);
      return response;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('unique')) {
        return ctx.badRequest('cnp or phone already exists');
      }
      throw error;
    }
  },

  /**
   * Advanced search across multiple fields with cabinet isolation
   */
  async search(ctx) {
    const { query } = ctx.request.query;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return ctx.badRequest('Search query parameter is required');
    }

    const searchTerm = query.trim();

    // Input length validation
    if (searchTerm.length > 100) {
      return ctx.badRequest('Search query too long (max 100 characters)');
    }

    const cabinetId = ctx.state.primaryCabinetId;

    try {
      const where: any = {
        $or: [
          { nume: { $containsi: searchTerm } },
          { prenume: { $containsi: searchTerm } },
          { cnp: { $containsi: searchTerm } },
          { telefon: { $containsi: searchTerm } },
          { email: { $containsi: searchTerm } },
        ],
      };

      // Apply cabinet isolation
      if (cabinetId) {
        where.cabinet = { id: { $eq: cabinetId } };
      }

      const results = await strapi.db.query('api::pacient.pacient').findMany({
        where,
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
   * Get patient statistics with cabinet isolation
   * Database-agnostic: works with both PostgreSQL and SQLite
   */
  async statistics(ctx) {
    try {
      const knex = strapi.db.connection;
      const dbClient: string = strapi.config.get('database.connection.client', 'sqlite');
      const cabinetId = ctx.state.primaryCabinetId;

      // Total count with cabinet filter
      let totalPatients: number;
      if (cabinetId) {
        const countResult = await knex('pacients')
          .join('pacients_cabinet_lnk', 'pacients.id', 'pacients_cabinet_lnk.pacient_id')
          .where('pacients_cabinet_lnk.cabinet_id', cabinetId)
          .whereNotNull('pacients.published_at')
          .count('pacients.id as count')
          .first();
        totalPatients = Number(countResult?.count ?? 0);
      } else {
        totalPatients = await strapi.db.query('api::pacient.pacient').count();
      }

      // Age distribution - use DB-specific date functions
      let ageDistribution = [];
      try {
        let ageQuery: string;
        const ageParams: any[] = [];

        // Cabinet join/filter fragments for raw SQL
        const cabinetJoin = cabinetId
          ? 'JOIN pacients_cabinet_lnk pcl ON pcl.pacient_id = pacients.id'
          : '';
        const cabinetWhere = cabinetId
          ? 'AND pcl.cabinet_id = ?'
          : '';
        if (cabinetId) {
          ageParams.push(cabinetId);
        }

        if (dbClient === 'postgres') {
          // PostgreSQL: use EXTRACT(YEAR FROM AGE(...))
          ageQuery = `
            SELECT age_group, COUNT(*) as count FROM (
              SELECT
                CASE
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 18 THEN 'Under 18'
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 35 THEN '18-35'
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 50 THEN '35-50'
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 65 THEN '50-65'
                  ELSE '65+'
                END as age_group,
                CASE
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 18 THEN 1
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 35 THEN 2
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 50 THEN 3
                  WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 65 THEN 4
                  ELSE 5
                END as sort_order
              FROM pacients
              ${cabinetJoin}
              WHERE data_nasterii IS NOT NULL AND published_at IS NOT NULL
              ${cabinetWhere}
            ) sub
            GROUP BY age_group, sort_order
            ORDER BY sort_order
          `;
        } else {
          // SQLite: use julianday for age calculation
          ageQuery = `
            SELECT age_group, COUNT(*) as count FROM (
              SELECT
                CASE
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 18 THEN 'Under 18'
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 35 THEN '18-35'
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 50 THEN '35-50'
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 65 THEN '50-65'
                  ELSE '65+'
                END as age_group,
                CASE
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 18 THEN 1
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 35 THEN 2
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 50 THEN 3
                  WHEN CAST((julianday('now') - julianday(data_nasterii)) / 365.25 AS INTEGER) < 65 THEN 4
                  ELSE 5
                END as sort_order
              FROM pacients
              ${cabinetJoin}
              WHERE data_nasterii IS NOT NULL AND published_at IS NOT NULL
              ${cabinetWhere}
            ) sub
            GROUP BY age_group, sort_order
            ORDER BY sort_order
          `;
        }

        const ageGroups = await knex.raw(ageQuery, ageParams);

        // PostgreSQL returns { rows: [...] }, SQLite returns the array directly
        if (dbClient === 'postgres') {
          ageDistribution = ageGroups.rows || [];
        } else {
          ageDistribution = Array.isArray(ageGroups) ? ageGroups : [];
        }
      } catch (sqlError: unknown) {
        const sqlMessage = sqlError instanceof Error ? sqlError.message : String(sqlError);
        strapi.log.warn('[STATISTICS] Age distribution query failed, using fallback', sqlMessage);
        ageDistribution = [];
      }

      // Cabinet statistics - uses link table (DB-agnostic SQL)
      let byCabinet = [];
      try {
        const cabinetParams: any[] = [];
        let cabinetWhereClause = 'WHERE c.published_at IS NOT NULL';

        if (cabinetId) {
          cabinetWhereClause += ' AND c.id = ?';
          cabinetParams.push(cabinetId);
        }

        const cabinetQuery = `
          SELECT
            c.nume_cabinet,
            COUNT(p.id) as patient_count
          FROM cabinets c
          LEFT JOIN pacients_cabinet_lnk pcl ON c.id = pcl.cabinet_id
          LEFT JOIN pacients p ON pcl.pacient_id = p.id AND p.published_at IS NOT NULL
          ${cabinetWhereClause}
          GROUP BY c.id, c.nume_cabinet
          ORDER BY patient_count DESC
        `;

        const cabinetStats = await knex.raw(cabinetQuery, cabinetParams);

        if (dbClient === 'postgres') {
          byCabinet = cabinetStats.rows || [];
        } else {
          byCabinet = Array.isArray(cabinetStats) ? cabinetStats : [];
        }
      } catch (cabinetError: unknown) {
        const cabinetMessage = cabinetError instanceof Error ? cabinetError.message : String(cabinetError);
        strapi.log.warn('[STATISTICS] Cabinet stats query failed', cabinetMessage);
        byCabinet = [];
      }

      return {
        total: totalPatients,
        ageDistribution,
        byCabinet,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      strapi.log.error('[STATISTICS] Error:', error);
      return ctx.internalServerError('Failed to generate statistics');
    }
  },
}));

