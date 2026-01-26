/**
 * Dashboard controller
 * Returns aggregated statistics for the dashboard page in a single request.
 * Replaces multiple full-entity fetches with lightweight SQL aggregations.
 */

export default {
  async stats(ctx) {
    const cabinetId = ctx.state.primaryCabinetId;

    if (!cabinetId) {
      return ctx.badRequest('No cabinet context available');
    }

    try {
      const knex = strapi.db.connection;
      const dbClient: string = strapi.config.get('database.connection.client', 'sqlite');

      // Helper to extract rows from raw query result (PostgreSQL vs SQLite)
      const extractRows = (result: unknown): Record<string, unknown>[] => {
        if (dbClient === 'postgres') {
          return (result as { rows: Record<string, unknown>[] }).rows || [];
        }
        return Array.isArray(result) ? result : [];
      };

      const extractScalar = (result: unknown, column: string): number => {
        const rows = extractRows(result);
        return Number(rows[0]?.[column]) || 0;
      };

      // Date expressions differ between PostgreSQL and SQLite
      const startOfMonth =
        dbClient === 'postgres'
          ? `DATE_TRUNC('month', CURRENT_DATE)`
          : `date('now', 'start of month')`;

      const currentDate = dbClient === 'postgres' ? `CURRENT_DATE` : `date('now')`;

      const currentTimestamp = dbClient === 'postgres' ? `NOW()` : `datetime('now')`;

      const dateOfDatetime = (col: string) =>
        dbClient === 'postgres' ? `${col}::date` : `date(${col})`;

      // Run all aggregation queries in parallel
      const [
        totalPatientsResult,
        newPatientsResult,
        todaysAppointmentsResult,
        upcomingTodayResult,
        pendingInvoicesResult,
        paidThisMonthResult,
      ] = await Promise.all([
        // 1. Total patients for this cabinet
        knex.raw(
          `SELECT COUNT(p.id) as cnt
           FROM pacients p
           INNER JOIN pacients_cabinet_lnk pcl ON pcl.pacient_id = p.id
           WHERE pcl.cabinet_id = ?
             AND p.published_at IS NOT NULL`,
          [cabinetId]
        ),

        // 2. New patients this month
        knex.raw(
          `SELECT COUNT(p.id) as cnt
           FROM pacients p
           INNER JOIN pacients_cabinet_lnk pcl ON pcl.pacient_id = p.id
           WHERE pcl.cabinet_id = ?
             AND p.published_at IS NOT NULL
             AND p.created_at >= ${startOfMonth}`,
          [cabinetId]
        ),

        // 3. Today's appointments count
        knex.raw(
          `SELECT COUNT(v.id) as cnt
           FROM vizitas v
           INNER JOIN vizitas_cabinet_lnk vcl ON vcl.vizita_id = v.id
           WHERE vcl.cabinet_id = ?
             AND v.published_at IS NOT NULL
             AND ${dateOfDatetime('v.data_programare')} = ${currentDate}`,
          [cabinetId]
        ),

        // 4. Upcoming today (future appointments today, not cancelled)
        knex.raw(
          `SELECT COUNT(v.id) as cnt
           FROM vizitas v
           INNER JOIN vizitas_cabinet_lnk vcl ON vcl.vizita_id = v.id
           WHERE vcl.cabinet_id = ?
             AND v.published_at IS NOT NULL
             AND ${dateOfDatetime('v.data_programare')} = ${currentDate}
             AND v.data_programare > ${currentTimestamp}
             AND v.status_vizita != 'Anulata'`,
          [cabinetId]
        ),

        // 5. Pending invoices: count + total amount
        knex.raw(
          `SELECT COUNT(f.id) as cnt, COALESCE(SUM(f.total), 0) as total_amount
           FROM facturas f
           INNER JOIN facturas_cabinet_lnk fcl ON fcl.factura_id = f.id
           WHERE fcl.cabinet_id = ?
             AND f.published_at IS NOT NULL
             AND f.status IS NOT NULL
             AND f.status != 'Platita'
             AND f.status != 'Anulata'`,
          [cabinetId]
        ),

        // 6. Paid this month total
        knex.raw(
          `SELECT COALESCE(SUM(f.total), 0) as total_amount
           FROM facturas f
           INNER JOIN facturas_cabinet_lnk fcl ON fcl.factura_id = f.id
           WHERE fcl.cabinet_id = ?
             AND f.published_at IS NOT NULL
             AND f.status = 'Platita'
             AND f.updated_at >= ${startOfMonth}`,
          [cabinetId]
        ),
      ]);

      const pendingRows = extractRows(pendingInvoicesResult);

      return {
        data: {
          totalPatients: extractScalar(totalPatientsResult, 'cnt'),
          newPatientsThisMonth: extractScalar(newPatientsResult, 'cnt'),
          todaysAppointments: extractScalar(todaysAppointmentsResult, 'cnt'),
          upcomingToday: extractScalar(upcomingTodayResult, 'cnt'),
          pendingInvoicesCount: Number(pendingRows[0]?.cnt) || 0,
          pendingInvoicesTotal: Number(pendingRows[0]?.total_amount) || 0,
          paidThisMonth: extractScalar(paidThisMonthResult, 'total_amount'),
        },
      };
    } catch (error) {
      strapi.log.error('[DASHBOARD STATS] Error:', error);
      return ctx.internalServerError('Failed to fetch dashboard statistics');
    }
  },
};
