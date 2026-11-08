// Reporting API (B2) against real PostgreSQL and the running API.
// Every fixture lives in its own throw-away organization/branch so branch and
// organization scoping can be asserted without touching existing data.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const API = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const suffix = randomUUID().slice(0, 8);
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

type Reply = { status: number; body: any; headers: Headers };

const riyadhDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Shift a YYYY-MM-DD business date without time-zone drift. */
const shiftDay = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

async function call(path: string, token?: string): Promise<Reply> {
  const response = await fetch(API + path, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  let body: any = null;
  const text = await response.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}

async function createUser(key: string, organizationId: string, branchId: string, role: string) {
  const inserted = await db.query(
    'INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [organizationId, branchId, key + '-' + suffix + '@it.local', await bcrypt.hash('Reporting-Pass-1', 4), key, role]
  );
  tokens[key] = jwt.sign({ sub: inserted.rows[0].id }, process.env.JWT_SECRET!, { expiresIn: '8h', issuer: 'musafir-pos' });
  return inserted.rows[0].id;
}

before(async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await fetch(API + '/api/health');
      if (health.ok) break;
    } catch { /* API is starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (attempt === 39) throw new Error('API did not become healthy at ' + API);
  }

  const org = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Reports IT ' + suffix, 'reports-it-' + suffix])).rows[0].id;
  const branch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [org, 'Main', 'RPT-' + suffix])).rows[0].id;
  const otherOrg = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Reports Other ' + suffix, 'reports-other-' + suffix])).rows[0].id;
  const otherBranch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [otherOrg, 'Main', 'RPT2-' + suffix])).rows[0].id;
  Object.assign(ids, { org, branch, otherOrg, otherBranch });

  const ownerId = await createUser('owner', org, branch, 'owner');
  await createUser('cashier', org, branch, 'cashier');
  await createUser('inventory', org, branch, 'inventory');
  await createUser('otherOwner', otherOrg, otherBranch, 'owner');

  // Menu items and stock used by the sales/inventory reports.
  const burger = (await db.query('INSERT INTO products(organization_id,sku,name,price) VALUES($1,$2,$3,$4) RETURNING id', [org, 'RPT-BURGER-' + suffix, 'Test Burger', 10])).rows[0].id;
  const fries = (await db.query('INSERT INTO products(organization_id,sku,name,price) VALUES($1,$2,$3,$4) RETURNING id', [org, 'RPT-FRIES-' + suffix, 'Test Fries', 10])).rows[0].id;
  const tomato = (await db.query(
    `INSERT INTO ingredients(organization_id,branch_id,sku,name,unit,stock,track_stock,reorder_level,unit_cost)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [org, branch, 'RPT-TOM-' + suffix, 'Tomato', 'kg', 4, true, 10, 2.5]
  )).rows[0].id;
  await db.query(
    `INSERT INTO ingredients(organization_id,branch_id,sku,name,unit,stock,track_stock,reorder_level,unit_cost)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [org, branch, 'RPT-NAP-' + suffix, 'Napkins', 'pack', 0, false, 0, 0]
  );
  Object.assign(ids, { burger, fries, tomato });

  // Orders: two paid today, one cancelled today, one three days ago.
  const insertOrder = async (orderNumber: number, type: string, status: string, subtotal: number, tax: number, total: number, daysAgo: number) =>
    (await db.query(
      `INSERT INTO orders(organization_id,branch_id,order_number,order_type,status,subtotal,tax,discount,total,created_by,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,0,$8,$9, now() - ($10::text || ' days')::interval) RETURNING id`,
      [org, branch, orderNumber, type, status, subtotal, tax, total, ownerId, String(daysAgo)]
    )).rows[0].id;

  const dineIn = await insertOrder(1001, 'Dine-in', 'Completed', 20, 3, 23, 0);
  const takeaway = await insertOrder(1002, 'Takeaway', 'Completed', 10, 1.5, 11.5, 0);
  const cancelled = await insertOrder(1003, 'Takeaway', 'Cancelled', 43.48, 6.52, 50, 0);
  const older = await insertOrder(1004, 'Pickup', 'Completed', 8.7, 1.3, 10, 3);

  await db.query(
    `INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,line_total) VALUES
     ($1,$2,'Test Burger',2,10,20), ($3,$4,'Test Fries',1,10,10), ($5,$6,'Test Fries',1,8.7,8.7)`,
    [dineIn, burger, takeaway, fries, older, fries]
  );
  await db.query(
    `INSERT INTO payments(organization_id,branch_id,order_id,amount,method,direction,note,created_by,created_at) VALUES
     ($1,$2,$3,23,'Cash','in','Order payment',$5, now()),
     ($1,$2,$4,11.5,'Mada','in','Order payment',$5, now()),
     ($1,$2,$6,10,'Cash','in','Order payment',$5, now() - interval '3 days')`,
    [org, branch, dineIn, takeaway, ownerId, older]
  );
  await db.query(
    `INSERT INTO stock_movements(branch_id,ingredient_id,movement_type,quantity_delta,reference_id,note,created_by) VALUES
     ($1,$2,'sale',-2,$3,'Order #1001',$4), ($1,$2,'waste',-1,$3,'Spoiled',$4)`,
    [branch, tomato, dineIn, ownerId]
  );

  // Operating costs: one expense today, one ten days ago.
  const businessDay = riyadhDay();
  await db.query(
    `INSERT INTO expenses(organization_id,branch_id,category,description,amount,payment_method,expense_date,created_by) VALUES
       ($1,$2,'Utilities','Electricity',4,'Cash',$4::date,$3),
       ($1,$2,'Utilities','Old bill',9,'Cash',$5::date,$3)`,
    [org, branch, ownerId, businessDay, shiftDay(businessDay, -10)]
  );

  const supplier = (await db.query('INSERT INTO suppliers(organization_id,name) VALUES($1,$2) RETURNING id', [org, 'Reports Supplier ' + suffix])).rows[0].id;
  await db.query(
    'INSERT INTO purchases(organization_id,branch_id,supplier_id,invoice_number,total,paid,status,created_by) VALUES($1,$2,$3,$4,30,10,$5,$6)',
    [org, branch, supplier, 'RPT-INV-' + suffix, 'received', ownerId]
  );

  // Payroll: one salary payment dated today.
  const employee = (await db.query(
    'INSERT INTO employees(organization_id,branch_id,name,monthly_salary) VALUES($1,$2,$3,$4) RETURNING id',
    [org, branch, 'Reports Employee ' + suffix, 100]
  )).rows[0].id;
  const payroll = (await db.query(
    `INSERT INTO payroll_records(employee_id,organization_id,branch_id,period,base_salary,net_salary)
     VALUES($1,$2,$3,$4,100,100) RETURNING id`,
    [employee, org, branch, businessDay.slice(0, 7)]
  )).rows[0].id;
  await db.query(
    "INSERT INTO payroll_payments(payroll_id,organization_id,branch_id,amount,method,payment_date) VALUES($1,$2,$3,50,'Cash',$4::date)",
    [payroll, org, branch, businessDay]
  );
});

after(async () => { await db.end(); });

test('sales report authenticates and enforces the reporting roles', async () => {
  const anonymous = await call('/api/reports/sales');
  assert.equal(anonymous.status, 401);

  const cashier = await call('/api/reports/sales', tokens.cashier);
  assert.equal(cashier.status, 403);
  assert.equal(cashier.body.error, 'Insufficient permission');

  const inventory = await call('/api/reports/sales', tokens.inventory);
  assert.equal(inventory.status, 403);

  const owner = await call('/api/reports/sales', tokens.owner);
  assert.equal(owner.status, 200);
  assert.equal(owner.headers.get('cache-control'), 'no-store');
  assert.equal(owner.body.branchId, ids.branch);
});

test('sales report totals, tender mix and best sellers come from the database', async () => {
  const response = await call('/api/reports/sales?range=Today', tokens.owner);
  assert.equal(response.status, 200);

  assert.deepEqual(response.body.totals, {
    orders: 2, subtotal: 30, tax: 4.5, discount: 0, revenue: 34.5, averageOrderValue: 17.25
  });
  assert.deepEqual(response.body.tenders, { Cash: 23, Mada: 11.5, total: 34.5 });
  assert.equal(response.body.excluded.cancelledOrders, 1);
  assert.deepEqual(response.body.topProducts[0], { name: 'Test Burger', quantity: 2, revenue: 20 });
  assert.equal(response.body.byDay.length, 1);
  assert.equal(response.body.byDay[0].day, riyadhDay());
  assert.equal(response.body.byDay[0].orders, 2);

  const byType = Object.fromEntries(response.body.byOrderType.map((row: any) => [row.orderType, row.revenue]));
  assert.deepEqual(byType, { 'Dine-in': 23, Takeaway: 11.5 });
});

test('date ranges select the right business days', async () => {
  const week = await call('/api/reports/sales?range=Last%207%20days', tokens.owner);
  assert.equal(week.status, 200);
  assert.equal(week.body.totals.orders, 3);
  assert.equal(week.body.totals.revenue, 44.5);
  assert.deepEqual(week.body.tenders, { Cash: 33, Mada: 11.5, total: 44.5 });

  const allTime = await call('/api/reports/sales?range=All%20time', tokens.owner);
  assert.equal(allTime.body.totals.orders, 3);

  const today = riyadhDay();
  const explicit = await call(`/api/reports/sales?from=${today}&to=${today}`, tokens.owner);
  assert.equal(explicit.body.totals.orders, 2);
  assert.equal(explicit.body.range.from, today);
  assert.equal(explicit.body.range.to, today);
});

test('invalid report periods are rejected with 400', async () => {
  for (const query of ['range=Yesterday', 'from=2026-02-30', 'from=2030-01-02&to=2030-01-01', 'format=pdf']) {
    const response = await call('/api/reports/sales?' + query, tokens.owner);
    assert.equal(response.status, 400, query + ' should be rejected');
    assert.ok(response.body.error, query + ' should explain the problem');
  }
});

test('reports never leak another branch or organization', async () => {
  const other = await call('/api/reports/sales?range=All%20time', tokens.otherOwner);
  assert.equal(other.status, 200);
  assert.equal(other.body.totals.orders, 0);
  assert.equal(other.body.totals.revenue, 0);
  assert.deepEqual(other.body.topProducts, []);
});

test('sales report exports CSV', async () => {
  const response = await fetch(API + '/api/reports/sales?range=Today&format=csv', {
    headers: { Authorization: 'Bearer ' + tokens.owner }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/csv/);
  const csv = await response.text();
  assert.match(csv, /Musafir Fast Food POS — sales report/);
  assert.match(csv, /"Revenue \(SAR\)","34.5"/);
  assert.match(csv, /"Test Burger","2","20"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('profit and loss includes recipe-valued COGS, expenses and salaries', async () => {
  const response = await call('/api/reports/pnl?range=Today', tokens.owner);
  assert.equal(response.status, 200);

  assert.deepEqual(response.body.revenue, { orders: 2, grossSales: 34.5, vat: 4.5, discounts: 0, netSales: 30 });
  assert.equal(response.body.cogs, 5);
  assert.equal(response.body.grossProfit, 25);
  assert.equal(response.body.grossMargin, 83.33);
  assert.deepEqual(response.body.operating, { expenses: 4, payrollPaid: 50, total: 54 });
  assert.equal(response.body.operatingResult, -29);
  assert.deepEqual(response.body.purchases, { value: 30, paid: 10 });
  assert.equal(response.body.waste, 2.5);
  assert.deepEqual(response.body.records, { expenseRecords: 1, payrollPaymentRecords: 1, purchaseRecords: 1 });

  // The cancelled order must never inflate revenue.
  assert.equal(response.body.revenue.grossSales, 34.5);

  const csv = await fetch(API + '/api/reports/pnl?range=Today&format=csv', { headers: { Authorization: 'Bearer ' + tokens.owner } });
  const body = await csv.text();
  assert.match(csv.headers.get('content-type') || '', /text\/csv/);
  assert.match(body, /"Operating result","-29"/);
  assert.match(body, /Cost of goods sold/);
});

test('inventory report values stock and flags reorder levels', async () => {
  const response = await call('/api/reports/inventory?range=Today', tokens.owner);
  assert.equal(response.status, 200);
  assert.equal(response.body.trackedItems, 1);
  assert.equal(response.body.untrackedItems, 1);
  assert.equal(response.body.stockValue, 10);
  assert.equal(response.body.lowStockCount, 1);
  assert.equal(response.body.lowStock[0].name, 'Tomato');
  assert.equal(response.body.lowStock[0].shortfall, 6);
  assert.deepEqual(response.body.waste, { value: 2.5, movements: 1 });

  // Inventory staff may read stock but never financial reporting.
  const inventoryRole = await call('/api/reports/inventory', tokens.inventory);
  assert.equal(inventoryRole.status, 200);
  const inventorySales = await call('/api/reports/sales', tokens.inventory);
  assert.equal(inventorySales.status, 403);

  const anonymous = await call('/api/reports/inventory');
  assert.equal(anonymous.status, 401);
});
