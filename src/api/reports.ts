/**
 * Typed client for the read-only reporting endpoints (B2).
 *
 * The back office keeps its local, instantly available totals; these calls add
 * the server-verified figures so an operator can compare what the browser shows
 * with what PostgreSQL recorded for the branch.
 */

export type ReportRange = { label: string; from: string | null; to: string | null };

export type SalesTotals = {
  orders: number;
  subtotal: number;
  tax: number;
  discount: number;
  revenue: number;
  averageOrderValue: number;
};

export type SalesReport = {
  branchId: string;
  generatedAt: string;
  timeZone: string;
  range: ReportRange;
  totals: SalesTotals;
  tenders: { Cash: number; Mada: number; total: number };
  byOrderType: Array<{ orderType: string; orders: number; revenue: number }>;
  byDay: Array<{ day: string; orders: number; revenue: number; tax: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  excluded: { cancelledOrders: number };
};

export type ProfitAndLossReport = {
  branchId: string;
  generatedAt: string;
  timeZone: string;
  range: ReportRange;
  revenue: { orders: number; grossSales: number; vat: number; discounts: number; netSales: number };
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  operating: { expenses: number; payrollPaid: number; total: number };
  purchases: { value: number; paid: number };
  waste: number;
  operatingResult: number;
  operatingMargin: number;
  records: { expenseRecords: number; payrollPaymentRecords: number; purchaseRecords: number };
};

type RequestOptions = { apiBase: string; token: string; range: string; signal?: AbortSignal };

async function getJson<T>(path: string, options: RequestOptions): Promise<T> {
  const base = options.apiBase.trim().replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${options.token}`, Accept: 'application/json' },
    signal: options.signal
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A proxy or gateway may return an empty body; the status tells the story.
  }
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error;
    throw new Error(message || `Reporting request failed (${response.status}).`);
  }
  if (!payload) throw new Error('The reporting service returned an empty response.');
  return payload as T;
}

const rangeQuery = (range: string) => '?range=' + encodeURIComponent(range.trim() || 'Today');

export function fetchSalesReport(options: RequestOptions): Promise<SalesReport> {
  return getJson<SalesReport>('/api/reports/sales' + rangeQuery(options.range), options);
}

export function fetchProfitAndLoss(options: RequestOptions): Promise<ProfitAndLossReport> {
  return getJson<ProfitAndLossReport>('/api/reports/pnl' + rangeQuery(options.range), options);
}
