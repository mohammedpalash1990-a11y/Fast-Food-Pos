// Pure helpers for employee, attendance and payroll money/date validation.
export const MAX_MONEY = 10_000_000;
export const PAYMENT_METHODS = ['Cash', 'Mada'] as const;
export type PayrollStatus = 'Unpaid' | 'Part-paid' | 'Paid';
export function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}
export function toCents(value: number | string): number {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) throw new Error('Invalid money amount');
  return Math.round(amount * 100);
}
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}
export function computeNetCents(base: number, bonus: number, advanceDeduction: number, otherDeduction: number): number {
  return toCents(base) + toCents(bonus) - toCents(advanceDeduction) - toCents(otherDeduction);
}
export function payrollStatus(netCents: number, paidCents: number): PayrollStatus {
  if (paidCents >= netCents) return 'Paid';
  if (paidCents > 0) return 'Part-paid';
  return 'Unpaid';
}
export function isValidIsoDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export function isValidPeriod(value: string): boolean {
  return /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value);
}
export function isDateNotInFuture(value: string, now: Date = new Date()): boolean {
  if (!isValidIsoDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const requested = Date.UTC(year, month - 1, day);
  const limit = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86400000;
  return requested <= limit;
}
