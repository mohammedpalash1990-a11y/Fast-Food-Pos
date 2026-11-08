/**
 * Database-backed reporting endpoints (B2).
 *
 * Every figure is computed from PostgreSQL for the authenticated branch, so the
 * dashboard can show verified totals instead of figures rebuilt from whatever
 * the browser happens to have cached. Reporting is read-only: no rows are
 * written here.
 *
 * Periods are business days in Asia/Riyadh. Rows are filtered with a half-open
 * UTC window (`>= from 00:00 +03`, `< day after to 00:00 +03`) so a sale at
 * 23:59 local time belongs to the correct day all year round.
 *
 * Cancelled orders are excluded from revenue, tender mix and best sellers, and
 * reported separately so the exclusion is visible rather than silent.
 */
import type { Express, RequestHandler, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  ReportQueryError, buildProfitAndLoss, buildSalesTotals, buildTenderMix, money, rankTopProducts,
  resolveRange, shapeDailySeries, shapeOrderTypeBreakdown, summariseInventory, toCsv, toNumber
} from './reports-math.js';

type ReportDeps = {
  pool: Pool;
  authenticate: RequestHandler;
  allow: (...roles: any[]) => RequestHandler;
  asyncRoute: (fn: (req: any, res: Response) => Promise<unknown>) => RequestHandler;
};

/** Financial reporting is restricted; cashiers and kitchen staff cannot read it. */
const FINANCE_ROLES = ['owner', 'manager', 'accountant'] as const;
const INVENTORY_ROLES = ['owner', 'manager', 'accountant', 'inventory'] as const;

const querySchema = z.object({
  range: z.string().trim().max(40).optional(),
  from: z.string().trim().max(10).optional(),
  to: z.string().trim().max(10).optional(),
  format: z.enum(['json', 'csv']).optional(),
  top: z.coerce.number().int().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

type ReportQuery = {
  range?: string;
  from?: string;
  to?: string;
  format: 'json' | 'csv';
  top: number;
  limit: number;
};

function parseReportQuery(raw: unknown): ReportQuery {
  const parsed = querySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new ReportQueryError('Invalid report query: ' + parsed.error.issues.map(issue => issue.message).join('; '));
  }
  const { range, from, to, format, top, limit } = parsed.data;
  return {
    range: range || undefined,
    from: from || undefined,
    to: to || undefined,
    format: format ?? 'json',
    top: top ?? 10,
    limit: limit ?? 25
  };
}

/**
 * Half-open business-day window for a `timestamptz` column.
 * `$3` (from) and `$4` (to) are nullable `YYYY-MM-DD` text parameters, so
 * "all time" simply passes NULLs and the predicate short-circuits.
 */
const timestampWindow = (alias: string): string =>
  `($3::date IS NULL OR ${alias}.created_at >= ($3::date::timestamp AT TIME ZONE 'Asia/Riyadh'))` +
  ` AND ($4::date IS NULL OR ${alias}.created_at < ((($4::date + 1)::timestamp) AT TIME ZONE 'Asia/Riyadh'))`;

/** Inclusive `date` column window (expenses, payroll payments). */
const dateWindow = (alias: string, column: string): string =>
  `($3::date IS NULL OR ${alias}.${column} >= $3::date)` +
  ` AND ($4::date IS NULL OR ${alias}.${column} <= $4::date)`;

const amount = (value: unknown) => money(value);
const count = (value: unknown) => toNumber(value);

export function registerReportRoutes(app: Express, deps: ReportDeps): void {
  const { pool, authenticate, allow, asyncRoute } = deps;

  // A report without a branch is meaningless, so branch-less accounts are refused
  // exactly like the HR module does.
  const guard = (...roles: string[]): RequestHandler[] => [
    authenticate,
    allow(...roles),
    ((req: any, res: Response, next) => {
      if (!req.user?.branchId) return res.status(403).json({ error: 'This account is not assigned to a branch' });
      next();
    }) as RequestHandler
  ];
  const scope = (req: any): [string, string] => [req.user.organizationId, req.user.branchId];

  /** Shared sales figures, reused by the sales report and the P&L report. */
  const loadSales = async (req: any, range: { from: string | null; to: string | null }) => {
    const params = [...scope(req), range.from, range.to];
    const [byType, tenders, daily, products, cancelled] = await Promise.all([
      pool.query(
        `SELECT o.order_type, COUNT(*)::int AS orders,
                COALESCE(SUM(o.subtotal), 0) AS subtotal,
                COALESCE(SUM(o.tax), 0) AS tax,
                COALESCE(SUM(o.discount), 0) AS discount,
                COALESCE(SUM(o.total), 0) AS total
           FROM orders o
          WHERE o.organization_id = $1 AND o.branch_id = $2 AND o.status <> 'Cancelled'
            AND ${timestampWindow('o')}
          GROUP BY o.order_type`,
        params
      ),
      pool.query(
        `SELECT p.method, COALESCE(SUM(p.amount), 0) AS amount
           FROM payments p
          WHERE p.organization_id = $1 AND p.branch_id = $2
            AND p.direction = 'in' AND p.order_id IS NOT NULL
            AND ${timestampWindow('p')}
          GROUP BY p.method`,
        params
      ),
      pool.query(
        `SELECT to_char(o.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS orders,
                COALESCE(SUM(o.total), 0) AS revenue,
                COALESCE(SUM(o.tax), 0) AS tax
           FROM orders o
          WHERE o.organization_id = $1 AND o.branch_id = $2 AND o.status <> 'Cancelled'
            AND ${timestampWindow('o')}
          GROUP BY day
          ORDER BY day DESC`,
        params
      ),
      pool.query(
        `SELECT oi.product_name AS name,
                COALESCE(SUM(oi.quantity), 0)::int AS quantity,
                COALESCE(SUM(oi.line_total), 0) AS revenue
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE o.organization_id = $1 AND o.branch_id = $2 AND o.status <> 'Cancelled'
            AND ${timestampWindow('o')}
          GROUP BY oi.product_name
          ORDER BY quantity DESC, revenue DESC, name`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cancelled
           FROM orders o
          WHERE o.organization_id = $1 AND o.branch_id = $2 AND o.status = 'Cancelled'
            AND ${timestampWindow('o')}`,
        params
      )
    ]);

    const totals = buildSalesTotals(byType.rows.map(row => ({
      orders: row.orders, subtotal: row.subtotal, tax: row.tax, discount: row.discount, total: row.total
    })));

    return {
      totals,
      tenders: buildTenderMix(tenders.rows),
      byOrderType: shapeOrderTypeBreakdown(byType.rows),
      byDay: shapeDailySeries(daily.rows),
      topProducts: rankTopProducts(products.rows, 10),
      excluded: { cancelledOrders: count(cancelled.rows[0]?.cancelled) }
    };
  };

  app.get('/api/reports/sales', ...guard(...FINANCE_ROLES), asyncRoute(async (req: any, res: Response) => {
    const query = parseReportQuery(req.query);
    const range = resolveRange(query);
    const sales = await loadSales(req, range);

    res.set('Cache-Control', 'no-store');
    if (query.format === 'csv') {
      const rows: Array<Array<string | number | null>> = [
        ['Musafir Fast Food POS — sales report'],
        ['Period', range.label],
        ['From', range.from ?? 'beginning'], ['To', range.to ?? 'now'],
        [],
        ['Summary', 'Value'],
        ['Orders', sales.totals.orders],
        ['Subtotal (SAR)', sales.totals.subtotal],
        ['VAT (SAR)', sales.totals.tax],
        ['Discounts (SAR)', sales.totals.discount],
        ['Revenue (SAR)', sales.totals.revenue],
        ['Average order value (SAR)', sales.totals.averageOrderValue],
        ['Excluded cancelled orders', sales.excluded.cancelledOrders],
        [],
        ['Tender', 'Amount (SAR)'],
        ['Cash', sales.tenders.Cash], ['Mada', sales.tenders.Mada], ['Total tendered', sales.tenders.total],
        [],
        ['Order type', 'Orders', 'Revenue (SAR)'],
        ...sales.byOrderType.map(row => [row.orderType, row.orders, row.revenue]),
        [],
        ['Date', 'Orders', 'Revenue (SAR)', 'VAT (SAR)'],
        ...sales.byDay.map(row => [row.day, row.orders, row.revenue, row.tax]),
        [],
        ['Item', 'Units', 'Revenue (SAR)'],
        ...sales.topProducts.map(row => [row.name, row.quantity, row.revenue])
      ];
      res.type('text/csv; charset=utf-8').attachment('sales-report-' + (range.from ?? 'all') + '.csv').send(toCsv(rows));
      return;
    }

    res.json({
      branchId: req.user.branchId,
      generatedAt: new Date().toISOString(),
      timeZone: 'Asia/Riyadh',
      range,
      ...sales
    });
  }));

  app.get('/api/reports/pnl', ...guard(...FINANCE_ROLES), asyncRoute(async (req: any, res: Response) => {
    const query = parseReportQuery(req.query);
    const range = resolveRange(query);
    const params = [...scope(req), range.from, range.to];

    const [sales, cogs, expenses, payroll, purchases, waste] = await Promise.all([
      loadSales(req, range),
      pool.query(
        `SELECT COALESCE(SUM(-sm.quantity_delta * i.unit_cost), 0) AS cogs
           FROM stock_movements sm
           JOIN ingredients i ON i.id = sm.ingredient_id AND i.organization_id = $1 AND i.branch_id = $2
          WHERE sm.branch_id = $2 AND sm.movement_type = 'sale'
            AND ${timestampWindow('sm')}`,
        params
      ),
      pool.query(
        `SELECT COALESCE(SUM(e.amount), 0) AS total, COUNT(*)::int AS records
           FROM expenses e
          WHERE e.organization_id = $1 AND e.branch_id = $2 AND ${dateWindow('e', 'expense_date')}`,
        params
      ),
      pool.query(
        `SELECT COALESCE(SUM(pp.amount), 0) AS paid, COUNT(*)::int AS records
           FROM payroll_payments pp
          WHERE pp.organization_id = $1 AND pp.branch_id = $2 AND ${dateWindow('pp', 'payment_date')}`,
        params
      ),
      pool.query(
        `SELECT COALESCE(SUM(pu.total), 0) AS value, COALESCE(SUM(pu.paid), 0) AS paid, COUNT(*)::int AS records
           FROM purchases pu
          WHERE pu.organization_id = $1 AND pu.branch_id = $2 AND pu.status = 'received'
            AND ${timestampWindow('pu')}`,
        params
      ),
      pool.query(
        `SELECT COALESCE(SUM(-sm.quantity_delta * i.unit_cost), 0) AS waste
           FROM stock_movements sm
           JOIN ingredients i ON i.id = sm.ingredient_id AND i.organization_id = $1 AND i.branch_id = $2
          WHERE sm.branch_id = $2 AND sm.movement_type = 'waste'
            AND ${timestampWindow('sm')}`,
        params
      )
    ]);

    const pnl = buildProfitAndLoss({
      orders: sales.totals.orders,
      grossSales: sales.totals.revenue,
      vat: sales.totals.tax,
      discounts: sales.totals.discount,
      cogs: cogs.rows[0]?.cogs,
      waste: waste.rows[0]?.waste,
      expenses: expenses.rows[0]?.total,
      payrollPaid: payroll.rows[0]?.paid,
      purchases: { value: purchases.rows[0]?.value, paid: purchases.rows[0]?.paid }
    });

    const records = {
      expenseRecords: count(expenses.rows[0]?.records),
      payrollPaymentRecords: count(payroll.rows[0]?.records),
      purchaseRecords: count(purchases.rows[0]?.records)
    };

    res.set('Cache-Control', 'no-store');
    if (query.format === 'csv') {
      const rows: Array<Array<string | number | null>> = [
        ['Musafir Fast Food POS — profit & loss'],
        ['Period', range.label],
        ['From', range.from ?? 'beginning'], ['To', range.to ?? 'now'],
        [],
        ['Line', 'Amount (SAR)'],
        ['Sales including VAT', pnl.revenue.grossSales],
        ['Less recorded VAT', -pnl.revenue.vat],
        ['Net sales', pnl.revenue.netSales],
        ['Cost of goods sold (recipe valuation)', -pnl.cogs],
        ['Gross profit', pnl.grossProfit],
        ['Operating expenses', -pnl.operating.expenses],
        ['Salary payments', -pnl.operating.payrollPaid],
        ['Operating result', pnl.operatingResult],
        [],
        ['Memo item', 'Amount (SAR)'],
        ['Purchases received (not an expense)', pnl.purchases.value],
        ['Purchase payments made', pnl.purchases.paid],
        ['Stock written off (waste)', pnl.waste],
        [],
        ['Orders', pnl.revenue.orders],
        ['Expense records', records.expenseRecords],
        ['Payroll payments', records.payrollPaymentRecords],
        ['Purchase records', records.purchaseRecords]
      ];
      res.type('text/csv; charset=utf-8').attachment('profit-and-loss-' + (range.from ?? 'all') + '.csv').send(toCsv(rows));
      return;
    }

    res.json({
      branchId: req.user.branchId,
      generatedAt: new Date().toISOString(),
      timeZone: 'Asia/Riyadh',
      range,
      ...pnl,
      records,
      basis: {
        revenue: 'for non-cancelled branch orders in the period',
        cogs: 'sale stock movements valued at the ingredient unit cost at report time',
        expenses: 'by expense date',
        payroll: 'by payroll payment date',
        purchases: 'reported as inventory acquisitions, never subtracted from operating result'
      }
    });
  }));

  app.get('/api/reports/inventory', ...guard(...INVENTORY_ROLES), asyncRoute(async (req: any, res: Response) => {
    const query = parseReportQuery(req.query);
    const range = resolveRange(query);
    const params = [...scope(req), range.from, range.to];

    const [ingredients, waste] = await Promise.all([
      pool.query(
        `SELECT i.name, i.stock, i.unit, i.reorder_level, i.unit_cost, i.track_stock, i.expires_on
           FROM ingredients i
          WHERE i.organization_id = $1 AND i.branch_id = $2
          ORDER BY i.name`,
        scope(req)
      ),
      pool.query(
        `SELECT COALESCE(SUM(-sm.quantity_delta * i.unit_cost), 0) AS value, COUNT(*)::int AS movements
           FROM stock_movements sm
           JOIN ingredients i ON i.id = sm.ingredient_id AND i.organization_id = $1 AND i.branch_id = $2
          WHERE sm.branch_id = $2 AND sm.movement_type = 'waste'
            AND ${timestampWindow('sm')}`,
        params
      )
    ]);

    const summary = summariseInventory(ingredients.rows, query.limit);
    res.set('Cache-Control', 'no-store');
    res.json({
      branchId: req.user.branchId,
      generatedAt: new Date().toISOString(),
      range,
      ...summary,
      waste: { value: amount(waste.rows[0]?.value), movements: count(waste.rows[0]?.movements) },
      valuation: 'tracked stock × ingredient unit cost'
    });
  }));
}
