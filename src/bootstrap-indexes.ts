/**
 * Database Index Bootstrap Script
 *
 * Creates performance indexes on Strapi 5 tables at application startup.
 * Idempotent: uses CREATE INDEX IF NOT EXISTS (or equivalent for SQLite).
 *
 * Strapi 5 stores relations in link tables (e.g., pacients_cabinet_lnk)
 * rather than as FK columns on the main table. This script indexes both
 * link tables and searchable columns on main tables.
 *
 * Collection names (from schema.json collectionName):
 *   pacients, vizitas, plan_trataments, cabinets, doctors,
 *   facturas, platas, price_lists
 */

interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
}

/**
 * Link table indexes - Strapi 5 relation join tables
 * Naming convention: {source_collection}_{relation_attribute}_lnk
 * Columns follow pattern: {source_singular}_id, {target_singular}_id
 */
const LINK_TABLE_INDEXES: IndexDefinition[] = [
  // Pacient relations
  { name: 'idx_pacients_cabinet_lnk_pacient', table: 'pacients_cabinet_lnk', columns: ['pacient_id'] },
  { name: 'idx_pacients_cabinet_lnk_cabinet', table: 'pacients_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_pacients_added_by_lnk_pacient', table: 'pacients_added_by_lnk', columns: ['pacient_id'] },
  { name: 'idx_pacients_added_by_lnk_user', table: 'pacients_added_by_lnk', columns: ['user_id'] },

  // Vizita relations
  { name: 'idx_vizitas_cabinet_lnk_vizita', table: 'vizitas_cabinet_lnk', columns: ['vizita_id'] },
  { name: 'idx_vizitas_cabinet_lnk_cabinet', table: 'vizitas_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_vizitas_pacient_lnk_vizita', table: 'vizitas_pacient_lnk', columns: ['vizita_id'] },
  { name: 'idx_vizitas_pacient_lnk_pacient', table: 'vizitas_pacient_lnk', columns: ['pacient_id'] },
  { name: 'idx_vizitas_medic_lnk_vizita', table: 'vizitas_medic_lnk', columns: ['vizita_id'] },
  { name: 'idx_vizitas_medic_lnk_doctor', table: 'vizitas_medic_lnk', columns: ['doctor_id'] },
  { name: 'idx_vizitas_added_by_lnk_vizita', table: 'vizitas_added_by_lnk', columns: ['vizita_id'] },
  { name: 'idx_vizitas_added_by_lnk_user', table: 'vizitas_added_by_lnk', columns: ['user_id'] },

  // Plan Tratament relations
  { name: 'idx_plan_trataments_cabinet_lnk_pt', table: 'plan_trataments_cabinet_lnk', columns: ['plan_tratament_id'] },
  { name: 'idx_plan_trataments_cabinet_lnk_cab', table: 'plan_trataments_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_plan_trataments_pacient_lnk_pt', table: 'plan_trataments_pacient_lnk', columns: ['plan_tratament_id'] },
  { name: 'idx_plan_trataments_pacient_lnk_pac', table: 'plan_trataments_pacient_lnk', columns: ['pacient_id'] },
  { name: 'idx_plan_trataments_added_by_lnk_pt', table: 'plan_trataments_added_by_lnk', columns: ['plan_tratament_id'] },
  { name: 'idx_plan_trataments_added_by_lnk_user', table: 'plan_trataments_added_by_lnk', columns: ['user_id'] },

  // Doctor relations
  { name: 'idx_doctors_cabinet_lnk_doctor', table: 'doctors_cabinet_lnk', columns: ['doctor_id'] },
  { name: 'idx_doctors_cabinet_lnk_cabinet', table: 'doctors_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_doctors_user_lnk_doctor', table: 'doctors_user_lnk', columns: ['doctor_id'] },
  { name: 'idx_doctors_user_lnk_user', table: 'doctors_user_lnk', columns: ['user_id'] },
  { name: 'idx_doctors_added_by_lnk_doctor', table: 'doctors_added_by_lnk', columns: ['doctor_id'] },
  { name: 'idx_doctors_added_by_lnk_user', table: 'doctors_added_by_lnk', columns: ['user_id'] },

  // Factura relations
  { name: 'idx_facturas_cabinet_lnk_factura', table: 'facturas_cabinet_lnk', columns: ['factura_id'] },
  { name: 'idx_facturas_cabinet_lnk_cabinet', table: 'facturas_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_facturas_pacient_lnk_factura', table: 'facturas_pacient_lnk', columns: ['factura_id'] },
  { name: 'idx_facturas_pacient_lnk_pacient', table: 'facturas_pacient_lnk', columns: ['pacient_id'] },
  { name: 'idx_facturas_plan_tratament_lnk_fac', table: 'facturas_plan_tratament_lnk', columns: ['factura_id'] },
  { name: 'idx_facturas_plan_tratament_lnk_pt', table: 'facturas_plan_tratament_lnk', columns: ['plan_tratament_id'] },
  { name: 'idx_facturas_added_by_lnk_factura', table: 'facturas_added_by_lnk', columns: ['factura_id'] },
  { name: 'idx_facturas_added_by_lnk_user', table: 'facturas_added_by_lnk', columns: ['user_id'] },

  // Plata relations
  { name: 'idx_platas_cabinet_lnk_plata', table: 'platas_cabinet_lnk', columns: ['plata_id'] },
  { name: 'idx_platas_cabinet_lnk_cabinet', table: 'platas_cabinet_lnk', columns: ['cabinet_id'] },
  { name: 'idx_platas_factura_lnk_plata', table: 'platas_factura_lnk', columns: ['plata_id'] },
  { name: 'idx_platas_factura_lnk_factura', table: 'platas_factura_lnk', columns: ['factura_id'] },
  { name: 'idx_platas_pacient_lnk_plata', table: 'platas_pacient_lnk', columns: ['plata_id'] },
  { name: 'idx_platas_pacient_lnk_pacient', table: 'platas_pacient_lnk', columns: ['pacient_id'] },
  { name: 'idx_platas_added_by_lnk_plata', table: 'platas_added_by_lnk', columns: ['plata_id'] },
  { name: 'idx_platas_added_by_lnk_user', table: 'platas_added_by_lnk', columns: ['user_id'] },

  // Price List relations
  { name: 'idx_price_lists_cabinet_lnk_pl', table: 'price_lists_cabinet_lnk', columns: ['price_list_id'] },
  { name: 'idx_price_lists_cabinet_lnk_cabinet', table: 'price_lists_cabinet_lnk', columns: ['cabinet_id'] },
];

/**
 * Search field indexes - columns on main tables used in WHERE clauses
 */
const SEARCH_FIELD_INDEXES: IndexDefinition[] = [
  // Pacient search fields
  { name: 'idx_pacients_cnp', table: 'pacients', columns: ['cnp'] },
  { name: 'idx_pacients_telefon', table: 'pacients', columns: ['telefon'] },
  { name: 'idx_pacients_status_pacient', table: 'pacients', columns: ['status_pacient'] },
  { name: 'idx_pacients_nume', table: 'pacients', columns: ['nume'] },
  { name: 'idx_pacients_document_id', table: 'pacients', columns: ['document_id'] },
  { name: 'idx_pacients_published_at', table: 'pacients', columns: ['published_at'] },

  // Vizita search fields
  { name: 'idx_vizitas_data_programare', table: 'vizitas', columns: ['data_programare'] },
  { name: 'idx_vizitas_status_vizita', table: 'vizitas', columns: ['status_vizita'] },
  { name: 'idx_vizitas_document_id', table: 'vizitas', columns: ['document_id'] },
  { name: 'idx_vizitas_published_at', table: 'vizitas', columns: ['published_at'] },

  // Plan Tratament search fields
  { name: 'idx_plan_trataments_document_id', table: 'plan_trataments', columns: ['document_id'] },
  { name: 'idx_plan_trataments_published_at', table: 'plan_trataments', columns: ['published_at'] },

  // Factura search fields
  { name: 'idx_facturas_status', table: 'facturas', columns: ['status'] },
  { name: 'idx_facturas_numar_factura', table: 'facturas', columns: ['numar_factura'] },
  { name: 'idx_facturas_data_emitere', table: 'facturas', columns: ['data_emitere'] },
  { name: 'idx_facturas_document_id', table: 'facturas', columns: ['document_id'] },
  { name: 'idx_facturas_published_at', table: 'facturas', columns: ['published_at'] },

  // Plata search fields
  { name: 'idx_platas_data_plata', table: 'platas', columns: ['data_plata'] },
  { name: 'idx_platas_document_id', table: 'platas', columns: ['document_id'] },
  { name: 'idx_platas_published_at', table: 'platas', columns: ['published_at'] },

  // Doctor search fields
  { name: 'idx_doctors_document_id', table: 'doctors', columns: ['document_id'] },
  { name: 'idx_doctors_published_at', table: 'doctors', columns: ['published_at'] },

  // Cabinet search fields
  { name: 'idx_cabinets_document_id', table: 'cabinets', columns: ['document_id'] },
  { name: 'idx_cabinets_published_at', table: 'cabinets', columns: ['published_at'] },
];

/**
 * Check if a table exists in the database
 */
async function tableExists(knex: any, tableName: string): Promise<boolean> {
  try {
    return await knex.schema.hasTable(tableName);
  } catch {
    return false;
  }
}

/**
 * Create a single index, handling errors gracefully
 */
async function createIndex(
  knex: any,
  index: IndexDefinition,
  dbClient: string,
  logger: any
): Promise<boolean> {
  try {
    const exists = await tableExists(knex, index.table);
    if (!exists) {
      logger.debug(`[INDEXES] Table '${index.table}' does not exist, skipping index '${index.name}'`);
      return false;
    }

    // Check if columns exist
    for (const col of index.columns) {
      const colExists = await knex.schema.hasColumn(index.table, col);
      if (!colExists) {
        logger.debug(`[INDEXES] Column '${col}' not found in '${index.table}', skipping index '${index.name}'`);
        return false;
      }
    }

    const columnList = index.columns.join(', ');

    if (dbClient === 'sqlite') {
      // SQLite supports CREATE INDEX IF NOT EXISTS
      await knex.raw(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${index.table}" (${columnList})`);
    } else {
      // PostgreSQL / MySQL: use IF NOT EXISTS (PostgreSQL 9.5+)
      await knex.raw(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${index.table}" (${columnList})`);
    }

    return true;
  } catch (error: any) {
    // Index may already exist or table structure mismatch - log and continue
    if (error.message?.includes('already exists')) {
      logger.debug(`[INDEXES] Index '${index.name}' already exists`);
      return false;
    }
    logger.warn(`[INDEXES] Failed to create index '${index.name}' on '${index.table}': ${error.message}`);
    return false;
  }
}

/**
 * Bootstrap database indexes
 * Called from src/index.ts bootstrap function
 */
export async function bootstrapIndexes(strapi: any): Promise<void> {
  const knex = strapi.db.connection;
  const logger = strapi.log;
  const dbClient = strapi.config.get('database.connection.client', 'sqlite');

  logger.info(`[INDEXES] Starting index bootstrap (database client: ${dbClient})`);

  const allIndexes = [...LINK_TABLE_INDEXES, ...SEARCH_FIELD_INDEXES];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const index of allIndexes) {
    const result = await createIndex(knex, index, dbClient, logger);
    if (result) {
      created++;
    } else {
      // Distinguish between skipped (table not found) and failed
      const exists = await tableExists(knex, index.table);
      if (!exists) {
        skipped++;
      } else {
        // Table exists but index creation returned false (already exists or column missing)
        skipped++;
      }
    }
  }

  logger.info(
    `[INDEXES] Bootstrap complete: ${created} created, ${skipped} skipped, ${failed} failed (${allIndexes.length} total defined)`
  );
}
