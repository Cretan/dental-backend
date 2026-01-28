/**
 * pacient controller
 */

import { factories } from '@strapi/strapi';
import { validateFieldLengths, validateCnp, validatePhone, validateEmail, calculateAge, sanitizeTextFields } from '../../../utils/validators';

const PATIENT_TEXT_FIELDS = ['nume', 'prenume', 'adresa', 'alergii', 'observatii'];

/**
 * PostgreSQL statistics: single CTE query combining total count,
 * age distribution, and cabinet stats.
 */
async function statisticsPostgres(knex: any, cabinetId: number) {
  const cteQuery = `
    WITH cabinet_patients AS (
      SELECT p.id, p.data_nasterii
      FROM pacients p
      JOIN pacients_cabinet_lnk pcl ON pcl.pacient_id = p.id
      WHERE pcl.cabinet_id = ?
        AND p.published_at IS NOT NULL
    ),
    total_count AS (
      SELECT COUNT(*) AS count FROM cabinet_patients
    ),
    age_distribution AS (
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 18 THEN 'Under 18'
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 35 THEN '18-35'
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 50 THEN '35-50'
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 65 THEN '50-65'
          ELSE '65+'
        END AS age_group,
        CASE
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 18 THEN 1
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 35 THEN 2
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 50 THEN 3
          WHEN EXTRACT(YEAR FROM AGE(CAST(data_nasterii AS DATE))) < 65 THEN 4
          ELSE 5
        END AS sort_order,
        COUNT(*) AS count
      FROM cabinet_patients
      WHERE data_nasterii IS NOT NULL
      GROUP BY age_group, sort_order
      ORDER BY sort_order
    ),
    cabinet_stats AS (
      SELECT
        c.nume_cabinet,
        COUNT(cp.id) AS patient_count
      FROM cabinets c
      LEFT JOIN pacients_cabinet_lnk pcl ON c.id = pcl.cabinet_id
      LEFT JOIN cabinet_patients cp ON cp.id = pcl.pacient_id
      WHERE c.published_at IS NOT NULL AND c.id = ?
      GROUP BY c.id, c.nume_cabinet
      ORDER BY patient_count DESC
    )
    SELECT json_build_object(
      'total', (SELECT count FROM total_count),
      'ageDistribution', COALESCE((SELECT json_agg(row_to_json(ad)) FROM age_distribution ad), '[]'::json),
      'byCabinet', COALESCE((SELECT json_agg(row_to_json(cs)) FROM cabinet_stats cs), '[]'::json)
    ) AS result
  `;

  const { rows } = await knex.raw(cteQuery, [cabinetId, cabinetId]);
  const result = rows[0]?.result || { total: 0, ageDistribution: [], byCabinet: [] };

  return {
    total: Number(result.total ?? 0),
    ageDistribution: result.ageDistribution || [],
    byCabinet: result.byCabinet || [],
    timestamp: new Date().toISOString(),
  };
}

/**
 * SQLite statistics: sequential queries (SQLite lacks CTEs with json_agg).
 */
async function statisticsSqlite(knex: any, cabinetId: number) {
  // Total count
  const countResult = await knex('pacients')
    .join('pacients_cabinet_lnk', 'pacients.id', 'pacients_cabinet_lnk.pacient_id')
    .where('pacients_cabinet_lnk.cabinet_id', cabinetId)
    .whereNotNull('pacients.published_at')
    .count('pacients.id as count')
    .first();
  const total = Number(countResult?.count ?? 0);

  // Age distribution
  let ageDistribution: any[] = [];
  try {
    const ageQuery = `
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
        JOIN pacients_cabinet_lnk pcl ON pcl.pacient_id = pacients.id
        WHERE data_nasterii IS NOT NULL AND published_at IS NOT NULL
        AND pcl.cabinet_id = ?
      ) sub
      GROUP BY age_group, sort_order
      ORDER BY sort_order
    `;
    const ageGroups = await knex.raw(ageQuery, [cabinetId]);
    ageDistribution = Array.isArray(ageGroups) ? ageGroups : [];
  } catch {
    ageDistribution = [];
  }

  // Cabinet stats
  let byCabinet: any[] = [];
  try {
    const cabinetQuery = `
      SELECT
        c.nume_cabinet,
        COUNT(p.id) as patient_count
      FROM cabinets c
      LEFT JOIN pacients_cabinet_lnk pcl ON c.id = pcl.cabinet_id
      LEFT JOIN pacients p ON pcl.pacient_id = p.id AND p.published_at IS NOT NULL
      WHERE c.published_at IS NOT NULL AND c.id = ?
      GROUP BY c.id, c.nume_cabinet
      ORDER BY patient_count DESC
    `;
    const cabinetStats = await knex.raw(cabinetQuery, [cabinetId]);
    byCabinet = Array.isArray(cabinetStats) ? cabinetStats : [];
  } catch {
    byCabinet = [];
  }

  return {
    total,
    ageDistribution,
    byCabinet,
    timestamp: new Date().toISOString(),
  };
}

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

    strapi.log.info(`[PACIENT CREATE] User ${ctx.state.user?.id} creating patient`);

    // Sanitize free-text fields (strip HTML tags)
    sanitizeTextFields(data, PATIENT_TEXT_FIELDS);

    // Input length validation (prevent abuse)
    const lengthError = validateFieldLengths(data);
    if (lengthError) {
      return ctx.badRequest(lengthError);
    }

    // Validation: cnp (Romanian Personal Identification Number)
    if (!data.cnp || !validateCnp(data.cnp)) {
      strapi.log.error(`[PACIENT CREATE] CNP validation failed for user ${ctx.state.user?.id}`);
      return ctx.badRequest('cnp invalid. Must be 13 digits with valid checksum.');
    }

    // Validation: Phone (Romanian format)
    if (!data.telefon || !validatePhone(data.telefon)) {
      strapi.log.error(`[PACIENT CREATE] Phone validation failed for user ${ctx.state.user?.id}`);
      return ctx.badRequest('Phone number invalid. Use format: +40700000000 or 0700000000');
    }

    // Validation: Email (if provided)
    if (data.email && !validateEmail(data.email)) {
      strapi.log.error(`[PACIENT CREATE] Email validation failed for user ${ctx.state.user?.id}`);
      return ctx.badRequest('Email invalid format');
    }

    // Validation: Birth date
    if (!data.data_nasterii) {
      strapi.log.error(`[PACIENT CREATE] Birth date missing`);
      return ctx.badRequest('Birth date is required');
    }

    const age = calculateAge(data.data_nasterii);
    if (age < 0 || age > 120) {
      strapi.log.error(`[PACIENT CREATE] Invalid birth date for user ${ctx.state.user?.id}`);
      return ctx.badRequest('Invalid birth date');
    }

    // Validation: Required fields
    if (!data.nume || !data.prenume) {
      strapi.log.error(`[PACIENT CREATE] Required fields missing for user ${ctx.state.user?.id}`);
      return ctx.badRequest('Last name (nume) and first name (prenume) are required');
    }

    // All validations passed - create patient
    try {
      const response = await super.create(ctx);
      strapi.log.info(`[PACIENT CREATE] Patient created with ID: ${response.data.id}`);
      return response;
    } catch (error: unknown) {
      strapi.log.error(`[PACIENT CREATE] DATABASE ERROR:`, error instanceof Error ? error.message : String(error));
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('unique')) {
        strapi.log.error(`[PACIENT CREATE] Duplicate entry detected for patient`);
        return ctx.badRequest('A patient with this information already exists');
      }
      throw error;
    }
  },

  /**
   * Update patient with validation
   */
  async update(ctx) {
    const { data } = ctx.request.body;

    // Sanitize free-text fields (strip HTML tags)
    sanitizeTextFields(data, PATIENT_TEXT_FIELDS);

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
        return ctx.badRequest('A patient with this information already exists');
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

      // SECURITY: Fail closed - require cabinet context
      if (!cabinetId) {
        return ctx.forbidden('No cabinet context available');
      }
      where.cabinet = { id: { $eq: cabinetId } };

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
   * Get patient statistics with cabinet isolation.
   * Uses a single CTE query on PostgreSQL, sequential queries on SQLite.
   */
  async statistics(ctx) {
    try {
      const knex = strapi.db.connection;
      const dbClient: string = strapi.config.get('database.connection.client', 'sqlite');
      const cabinetId = ctx.state.primaryCabinetId;

      // SECURITY: Fail closed - require cabinet context to prevent cross-tenant data leak
      if (!cabinetId) {
        return ctx.forbidden('No cabinet context available');
      }

      if (dbClient === 'postgres') {
        return await statisticsPostgres(knex, cabinetId);
      }
      return await statisticsSqlite(knex, cabinetId);
    } catch (error) {
      strapi.log.error('[STATISTICS] Error:', error);
      return ctx.internalServerError('Failed to generate statistics');
    }
  },
}));

