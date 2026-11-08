// Pure reporting rules (B2): periods, money, tender mix, profit & loss, stock valuation, CSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReportQueryError, addDays, buildProfitAndLoss, buildSalesTotals, buildTenderMix, businessToday,
  isValidIsoDate, money, percent, rankTopProducts, resolveRange, shapeDailySeries, shapeOrderTypeBreakdown,
  summariseInventory, toCsv, toNumber
} from '../../server/reports-math.js';

test('only real calendar dates in ISO form are accepted', () => {
  assert.equal(isValidIsoDate('2026-11-08'), true);
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2026-02-29'), false);
  assert.equal(isValidIsoDate('2026-13-01'), false);
  assert.equal(isValidIsoDate('2026-00-10'), false);
  assert.equal(isValidIsoDate('2026-11-31'), false);
  assert.equal(isValidIsoDate('2026-1-1'), false);
  assert.equal(isValidIsoDate(''), false);
  assert.equal(isValidIsoDate(undefined), false);
  assert.equal(isValidIsoDate(20261108), false);
});

test('calendar arithmetic crosses month and year boundaries', () => {
  assert.equal(addDays('2026-11-08', -6), '2026-11-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.throws(() => addDays('not-a-date', 1), ReportQueryError);
});

test('the business day follows Asia/Riyadh, not UTC', () => {
  // 21:30 UTC is already 00:30 on the next calendar day in Riyadh (UTC+3).
  assert.equal(businessToday(new Date('2026-11-08T21:30:00Z')), '2026-11-09');
  assert.equal(businessToday(new Date('2026-11-08T20:59:00Z')), '2026-11-08');
  assert.equal(businessToday(new Date('2026-11-08T09:00:00Z')), '2026-11-08');
});

test('range shortcuts resolve to inclusive business days', () => {
  const today = '2026-11-08';
  assert.deepEqual(resolveRange({ range: 'Today' }, today), { label: 'Today (2026-11-08)', from: today, to: today });
  assert.deepEqual(resolveRange({}, today), { label: 'Today (2026-11-08)', from: today, to: today });
  assert.deepEqual(resolveRange({ range: 'Last 7 days' }, today), { label: 'Last 7 days', from: '2026-11-02', to: today });
  assert.deepEqual(resolveRange({ range: 'This month' }, today), { label: 'This month', from: '2026-11-01', to: today });
  assert.deepEqual(resolveRange({ range: 'All time' }, today), { label: 'All time', from: null, to: null });
  // January must not fall back into the previous year.
  assert.deepEqual(resolveRange({ range: 'This month' }, '2026-01-15'), { label: 'This month', from: '2026-01-01', to: '2026-01-15' });
});

test('explicit from/to periods are validated', () => {
  assert.deepEqual(resolveRange({ from: '2026-10-01', to: '2026-10-31' }, '2026-11-08'), {
    label: '2026-10-01 → 2026-10-31', from: '2026-10-01', to: '2026-10-31'
  });
  assert.deepEqual(resolveRange({ from: '2026-10-05', to: '2026-10-05' }, '2026-11-08'), {
    label: '2026-10-05', from: '2026-10-05', to: '2026-10-05'
  });
  // A single `from` runs up to today.
  assert.deepEqual(resolveRange({ from: '2026-11-01' }, '2026-11-08'), {
    label: '2026-11-01 → 2026-11-08', from: '2026-11-01', to: '2026-11-08'
  });
  assert.throws(() => resolveRange({ from: '2026-11-09', to: '2026-11-08' }), /from must be on or before to/);
  assert.throws(() => resolveRange({ from: '2026-02-30' }, '2026-11-08'), /real dates/);
  assert.throws(() => resolveRange({ range: 'Yesterday' }), /range must be one of/);
});

test('report query errors carry a 400 status for the API error handler', () => {
  const error = new ReportQueryError('bad range');
  assert.equal(error.status, 400);
  assert.equal(error.message, 'bad range');
  assert.ok(error instanceof Error);
});

test('numbers from PostgreSQL never leak NaN into a report', () => {
  assert.equal(toNumber('12.500'), 12.5);
  assert.equal(toNumber(null), 0);
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber(''), 0);
  assert.equal(toNumber('abc'), 0);
  assert.equal(money('19.999'), 20);
  assert.equal(percent(1, 0), 0);
  assert.equal(percent(25, 200), 12.5);
});

test('sales totals sum string numerics and derive the average order value', () => {
  const totals = buildSalesTotals([
    { orders: '1', subtotal: '20.00', tax: '3.00', discount: '0', total: '23.00' },
    { orders: 1, subtotal: '10.00', tax: '1.50', discount: '0.50', total: '11.00' }
  ]);
  assert.deepEqual(totals, { orders: 2, subtotal: 30, tax: 4.5, discount: 0.5, revenue: 34, averageOrderValue: 17 });
  assert.deepEqual(buildSalesTotals([]), { orders: 0, subtotal: 0, tax: 0, discount: 0, revenue: 0, averageOrderValue: 0 });
});

test('tender mix keeps only Cash and Mada and rounds to two decimals', () => {
  const mix = buildTenderMix([
    { method: 'Cash', amount: '10.005' },
    { method: 'Mada', amount: '5.00' },
    { method: 'Cash', amount: '1.00' },
    { method: 'Visa', amount: '99.00' }
  ]);
  assert.deepEqual(mix, { Cash: 11.01, Mada: 5, total: 16.01 });
  assert.deepEqual(buildTenderMix([]), { Cash: 0, Mada: 0, total: 0 });
});

test('best sellers rank by units, then revenue, then name', () => {
  const ranked = rankTopProducts([
    { name: 'Fries', quantity: '3', revenue: '15.00' },
    { name: 'Burger', quantity: '3', revenue: '60.00' },
    { name: 'Cola', quantity: '9', revenue: '18.00' },
    { name: 'Apple', quantity: '3', revenue: '60.00' }
  ], 3);
  assert.deepEqual(ranked.map(row => row.name), ['Cola', 'Apple', 'Burger']);
  assert.deepEqual(ranked[0], { name: 'Cola', quantity: 9, revenue: 18 });
  assert.equal(rankTopProducts([{ name: 'X', quantity: 1, revenue: 1 }], 0).length, 1);
});

test('daily series and order type breakdown are ordered deterministically', () => {
  const daily = shapeDailySeries([
    { day: '2026-11-08', orders: '2', revenue: '34.5', tax: '4.5' },
    { day: '2026-11-06', orders: 1, revenue: '10', tax: '1.3' }
  ]);
  assert.deepEqual(daily.map(row => row.day), ['2026-11-06', '2026-11-08']);
  assert.deepEqual(daily[1], { day: '2026-11-08', orders: 2, revenue: 34.5, tax: 4.5 });

  const byType = shapeOrderTypeBreakdown([
    { order_type: 'Takeaway', orders: 1, total: '11' },
    { order_type: 'Dine-in', orders: 2, revenue: '34' }
  ]);
  assert.deepEqual(byType[0], { orderType: 'Dine-in', orders: 2, revenue: 34 });
  assert.deepEqual(byType[1], { orderType: 'Takeaway', orders: 1, revenue: 11 });
});

test('profit and loss separates VAT, COGS, operating costs and purchases', () => {
  const pnl = buildProfitAndLoss({
    orders: '2', grossSales: '34.50', vat: '4.50', discounts: '0',
    cogs: '5.00', waste: '2.50', expenses: '4.00', payrollPaid: '50.00',
    purchases: { value: '30.00', paid: '10.00' }
  });
  assert.deepEqual(pnl.revenue, { orders: 2, grossSales: 34.5, vat: 4.5, discounts: 0, netSales: 30 });
  assert.equal(pnl.cogs, 5);
  assert.equal(pnl.grossProfit, 25);
  assert.equal(pnl.grossMargin, 83.33);
  assert.deepEqual(pnl.operating, { expenses: 4, payrollPaid: 50, total: 54 });
  assert.equal(pnl.operatingResult, -29);
  assert.equal(pnl.operatingMargin, -96.67);
  // Purchases are memo information; they must never be subtracted twice.
  assert.deepEqual(pnl.purchases, { value: 30, paid: 10 });
  assert.equal(pnl.waste, 2.5);
});

test('profit and loss is empty-safe and never divides by zero', () => {
  const pnl = buildProfitAndLoss({});
  assert.equal(pnl.revenue.netSales, 0);
  assert.equal(pnl.operatingResult, 0);
  assert.equal(pnl.grossMargin, 0);
  assert.equal(pnl.operatingMargin, 0);
  // VAT cannot exceed recorded sales.
  const odd = buildProfitAndLoss({ grossSales: 10, vat: 12 });
  assert.equal(odd.revenue.netSales, 0);
});

test('inventory summary values tracked stock and flags reorder levels', () => {
  const summary = summariseInventory([
    { name: 'Tomato', stock: '4', unit: 'kg', reorder_level: '10', unit_cost: '2.5', track_stock: true },
    { name: 'Lettuce', stock: 20, unit: 'kg', reorderLevel: 5, unitCost: 1, trackStock: true },
    { name: 'Napkins', stock: 0, unit: 'pack', reorderLevel: 0, unitCost: 0, trackStock: false }
  ]);
  assert.equal(summary.trackedItems, 2);
  assert.equal(summary.untrackedItems, 1);
  assert.equal(summary.stockValue, 30);
  assert.equal(summary.unitsInStock, 24);
  assert.equal(summary.lowStockCount, 1);
  assert.deepEqual(summary.lowStock[0], {
    name: 'Tomato', stock: 4, unit: 'kg', reorderLevel: 10, unitCost: 2.5, shortfall: 6, value: 10
  });
  assert.equal(summariseInventory([], 5).lowStock.length, 0);
});

test('CSV export quotes separators, quotes and newlines with CRLF endings', () => {
  const csv = toCsv([['Name', 'Note'], ['Burger, large', 'He said "extra"'], ['Line\nbreak', null]]);
  assert.equal(csv, '"Name","Note"\r\n"Burger, large","He said ""extra"""\r\n"Line\nbreak",""\r\n');
  assert.ok(csv.endsWith('\r\n'));
});
