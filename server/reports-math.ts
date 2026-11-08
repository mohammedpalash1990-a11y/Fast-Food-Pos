/**
 * Reporting rules for the sales, profit & loss and inventory reports.
 *
 * Everything in this module is pure and deterministic: the routes in
 * `server/reports.ts` fetch rows from PostgreSQL and then hand them to these
 * helpers. Business rules (which orders count as sales, how VAT and discounts
 * are split, how cost of goods sold is valued, how a period is resolved in the
 * Asia/Riyadh business day) therefore live in one place and are unit tested
 * without a database.
 */

export const REPORT_RANGES = ['Today', 'Last 7 days', 'This month', 'All time'] as const;
export type ReportRangeName = (typeof REPORT_RANGES)[number];

/** Business time zone used for every reporting period. */
export const REPORT_TIME_ZONE = 'Asia/Riyadh';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A rejected report query. `status` is understood by the API error handler. */
export class ReportQueryError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ReportQueryError';
  }
}

export type ResolvedRange = {
  /** Human readable label, echoed back to the UI and into CSV exports. */
  label: string;
  /** First business day in the period, or null for "all time". */
  from: string | null;
  /** Last business day in the period (inclusive), or null for "all time". */
  to: string | null;
};

export type RangeQuery = { range?: string; from?: string; to?: string };

/** True only for a real calendar date in `YYYY-MM-DD` form. */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Calendar-day arithmetic that is immune to DST and time zones. */
export function addDays(isoDate: string, days: number): string {
  if (!isValidIsoDate(isoDate)) throw new ReportQueryError('A real date in YYYY-MM-DD format is required');
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Today's date in the restaurant's business time zone. */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

/**
 * Turn a `range=Today|Last 7 days|This month|All time` shortcut, or an explicit
 * `from`/`to` pair, into the inclusive business-day period that is queried.
 * `today` is injectable so the rules can be tested on a fixed date.
 */
export function resolveRange(query: RangeQuery, today: string = businessToday()): ResolvedRange {
  if (!isValidIsoDate(today)) throw new ReportQueryError('The reporting clock produced an invalid date');

  if (query.from || query.to) {
    const from = query.from ?? query.to!;
    const to = query.to ?? today;
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      throw new ReportQueryError('from and to must be real dates in YYYY-MM-DD format');
    }
    if (from > to) throw new ReportQueryError('from must be on or before to');
    return { label: from === to ? from : `${from} → ${to}`, from, to };
  }

  const requested = query.range ?? 'Today';
  if (!REPORT_RANGES.includes(requested as ReportRangeName)) {
    throw new ReportQueryError(`range must be one of: ${REPORT_RANGES.join(', ')}`);
  }
  switch (requested as ReportRangeName) {
    case 'Today':
      return { label: `Today (${today})`, from: today, to: today };
    case 'Last 7 days':
      return { label: 'Last 7 days', from: addDays(today, -6), to: today };
    case 'This month':
      return { label: 'This month', from: `${today.slice(0, 7)}-01`, to: today };
    default:
      return { label: 'All time', from: null, to: null };
  }
}

/** PostgreSQL numeric columns arrive as strings; never let NaN leak into a report. */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Round to fils/cents so repeated and aggregated figures agree exactly. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round a stored or derived amount to two decimals. */
export function money(value: unknown): number {
  return round2(toNumber(value));
}

/** Percentage helper that reports 0 instead of dividing by zero. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : round2((part / whole) * 100);
}

export function sumField<T>(rows: T[], pick: (row: T) => unknown): number {
  return round2(rows.reduce((sum, row) => sum + toNumber(pick(row)), 0));
}

export type SalesLine = {
  orders?: unknown;
  subtotal?: unknown;
  tax?: unknown;
  discount?: unknown;
  total?: unknown;
};

export type SalesTotals = {
  orders: number;
  subtotal: number;
  tax: number;
  discount: number;
  revenue: number;
  averageOrderValue: number;
};

/** Order totals for a period. Cancelled orders are filtered out before this point. */
export function buildSalesTotals(lines: SalesLine[]): SalesTotals {
  const totals = lines.reduce<{ orders: number; subtotal: number; tax: number; discount: number; revenue: number }>(
    (accumulator, line) => ({
      orders: accumulator.orders + toNumber(line.orders),
      subtotal: accumulator.subtotal + toNumber(line.subtotal),
      tax: accumulator.tax + toNumber(line.tax),
      discount: accumulator.discount + toNumber(line.discount),
      revenue: accumulator.revenue + toNumber(line.total)
    }),
    { orders: 0, subtotal: 0, tax: 0, discount: 0, revenue: 0 }
  );
  return {
    orders: totals.orders,
    subtotal: round2(totals.subtotal),
    tax: round2(totals.tax),
    discount: round2(totals.discount),
    revenue: round2(totals.revenue),
    averageOrderValue: totals.orders === 0 ? 0 : round2(totals.revenue / totals.orders)
  };
}

export type PaymentMethod = 'Cash' | 'Mada';
export type TenderMix = Record<PaymentMethod, number> & { total: number };

/** Cash / Mada split. Only Mada and Cash exist in this POS; anything else is ignored. */
export function buildTenderMix(rows: Array<{ method?: unknown; amount?: unknown }>): TenderMix {
  let cash = 0;
  let mada = 0;
  for (const row of rows) {
    const amount = toNumber(row.amount);
    if (row.method === 'Mada') mada += amount;
    else if (row.method === 'Cash') cash += amount;
  }
  return { Cash: round2(cash), Mada: round2(mada), total: round2(cash + mada) };
}

export type OrderTypeRow = { order_type?: unknown; orderType?: unknown; orders?: unknown; revenue?: unknown; total?: unknown };

export function shapeOrderTypeBreakdown(rows: OrderTypeRow[]): Array<{ orderType: string; orders: number; revenue: number }> {
  return rows.map(row => ({
    orderType: String(row.order_type ?? row.orderType ?? 'Unknown'),
    orders: toNumber(row.orders),
    revenue: money(row.revenue ?? row.total)
  })).sort((left, right) => right.revenue - left.revenue);
}

export type DailyRow = { day?: unknown; orders?: unknown; revenue?: unknown; total?: unknown; tax?: unknown };

export function shapeDailySeries(rows: DailyRow[]): Array<{ day: string; orders: number; revenue: number; tax: number }> {
  return rows.map(row => ({
    day: String(row.day ?? ''),
    orders: toNumber(row.orders),
    revenue: money(row.revenue ?? row.total),
    tax: money(row.tax)
  })).sort((left, right) => left.day.localeCompare(right.day));
}

export type ProductRow = { name?: unknown; quantity?: unknown; revenue?: unknown };

/** Best sellers: units first, then revenue, then name, so the order is stable. */
export function rankTopProducts(rows: ProductRow[], limit = 10): Array<{ name: string; quantity: number; revenue: number }> {
  return rows
    .map(row => ({ name: String(row.name ?? 'Unknown item'), quantity: toNumber(row.quantity), revenue: money(row.revenue) }))
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue || left.name.localeCompare(right.name))
    .slice(0, Math.max(1, limit));
}

export type ProfitAndLossInput = {
  orders?: unknown;
  grossSales?: unknown;
  vat?: unknown;
  discounts?: unknown;
  cogs?: unknown;
  waste?: unknown;
  expenses?: unknown;
  payrollPaid?: unknown;
  purchases?: { value?: unknown; paid?: unknown };
};

export type ProfitAndLoss = {
  revenue: { orders: number; grossSales: number; vat: number; discounts: number; netSales: number };
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  operating: { expenses: number; payrollPaid: number; total: number };
  purchases: { value: number; paid: number };
  waste: number;
  operatingResult: number;
  operatingMargin: number;
};

/**
 * Sales are reported net of the VAT that was recorded on the order, because VAT
 * is collected for the tax authority and not earned by the restaurant.
 * Operating result = net sales − COGS − operating expenses − salary payments.
 * Purchases are reported separately: they are an inventory acquisition, not an
 * expense in the period, so they are never subtracted here.
 */
export function buildProfitAndLoss(input: ProfitAndLossInput): ProfitAndLoss {
  const grossSales = money(input.grossSales);
  const vat = money(input.vat);
  const discounts = money(input.discounts);
  const netSales = round2(Math.max(0, grossSales - vat));
  const cogs = money(input.cogs);
  const expenses = money(input.expenses);
  const payrollPaid = money(input.payrollPaid);
  const grossProfit = round2(netSales - cogs);
  const operatingResult = round2(grossProfit - expenses - payrollPaid);
  return {
    revenue: { orders: toNumber(input.orders), grossSales, vat, discounts, netSales },
    cogs,
    grossProfit,
    grossMargin: percent(grossProfit, netSales),
    operating: { expenses, payrollPaid, total: round2(expenses + payrollPaid) },
    purchases: { value: money(input.purchases?.value), paid: money(input.purchases?.paid) },
    waste: money(input.waste),
    operatingResult,
    operatingMargin: percent(operatingResult, netSales)
  };
}

export type InventoryRow = {
  name?: unknown;
  stock?: unknown;
  unit?: unknown;
  reorder_level?: unknown;
  reorderLevel?: unknown;
  unit_cost?: unknown;
  unitCost?: unknown;
  track_stock?: unknown;
  trackStock?: unknown;
};

export type InventorySummary = {
  trackedItems: number;
  untrackedItems: number;
  stockValue: number;
  unitsInStock: number;
  lowStockCount: number;
  lowStock: Array<{ name: string; stock: number; unit: string; reorderLevel: number; unitCost: number; shortfall: number; value: number }>;
};

/** Stock valuation and reorder alerts for the branch. */
export function summariseInventory(rows: InventoryRow[], limit = 25): InventorySummary {
  let trackedItems = 0;
  let untrackedItems = 0;
  let stockValue = 0;
  let unitsInStock = 0;
  const lowStock: InventorySummary['lowStock'] = [];

  for (const row of rows) {
    const tracked = Boolean(row.track_stock ?? row.trackStock ?? false);
    const stock = toNumber(row.stock);
    const unitCost = toNumber(row.unit_cost ?? row.unitCost);
    const reorderLevel = toNumber(row.reorder_level ?? row.reorderLevel);
    if (!tracked) {
      untrackedItems += 1;
      continue;
    }
    trackedItems += 1;
    unitsInStock += stock;
    stockValue += stock * unitCost;
    if (stock <= reorderLevel) {
      lowStock.push({
        name: String(row.name ?? 'Unknown item'),
        stock: round2(stock),
        unit: String(row.unit ?? ''),
        reorderLevel: round2(reorderLevel),
        unitCost: round2(unitCost),
        shortfall: round2(Math.max(0, reorderLevel - stock)),
        value: round2(stock * unitCost)
      });
    }
  }

  lowStock.sort((left, right) => left.stock - right.stock || left.name.localeCompare(right.name));
  return {
    trackedItems,
    untrackedItems,
    stockValue: round2(stockValue),
    unitsInStock: round2(unitsInStock),
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, Math.max(1, limit))
  };
}

/** RFC 4180 quoting, CRLF line endings, and a trailing newline. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const body = rows
    .map(row => row.map(cell => {
      const text = cell === null || cell === undefined ? '' : String(cell);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(','))
    .join('\r\n');
  return body + '\r\n';
}
