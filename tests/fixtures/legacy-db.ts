/**
 * Fixture builder for the legacy Render -> Neon transfer tests.
 *
 * Produces a "legacy" database that looks like the older production schema but has
 * the kinds of problems a real migration meets:
 *   - duplicate values that the Neon unique keys reject
 *   - a legacy-only table the Neon schema does not know about
 *   - a column that the Neon schema has dropped / never had
 *   - timestamps with microsecond precision
 *   - NULLs that must survive exactly
 */
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const MIGRATIONS = [
  '001_initial.sql', '002_team_payroll.sql', '003_reservations.sql', '004_restaurant_tables.sql',
  '005_delivery_dispatch.sql', '006_order_table_assignment.sql', '007_order_idempotency.sql',
  '008_payroll_hardening.sql'
];

export async function applySchema(client: Client): Promise<void> {
  for (const file of MIGRATIONS) {
    const sql = await readFile(new URL('../../db/migrations/' + file, import.meta.url), 'utf8');
    await client.query(sql);
  }
}

export function client(connectionString: string): Client {
  return new Client({ connectionString });
}

export type SeedResult = {
  ids: {
    organization: string;
    branch: string;
    owner: string;
    cashier: string;
    category: string;
    product: string;
    productTwo: string;
    ingredient: string;
    table: string;
    customer: string;
    supplier: string;
    order: string;
    orderTwo: string;
  };
  counts: Record<string, number>;
};

/**
 * Create a fresh legacy database content set. `options.clean` skips every planted
 * problem so the happy path can be tested too.
 */
export async function seedLegacy(client: Client, options: { clean?: boolean } = {}): Promise<SeedResult> {
  const clean = options.clean === true;
  // A legacy production database runs the same application schema, so build it
  // first. Tests that need an unmigrated target simply skip this call.
  await applySchema(client);
  await client.query('BEGIN');

  const org = (await client.query(
    "INSERT INTO organizations(name, slug) VALUES('Musafir Fast Food','musafir-legacy') RETURNING id"
  )).rows[0].id;
  const branch = (await client.query(
    "INSERT INTO branches(organization_id, name, code) VALUES($1,'Main Branch','KSA-01') RETURNING id", [org]
  )).rows[0].id;
  const owner = (await client.query(
    "INSERT INTO users(organization_id, branch_id, email, password_hash, display_name, role) VALUES($1,$2,'owner@musafir.test','legacy-hash','Legacy Owner','owner') RETURNING id",
    [org, branch]
  )).rows[0].id;
  const cashier = (await client.query(
    "INSERT INTO users(organization_id, branch_id, email, password_hash, display_name, role) VALUES($1,$2,'cashier@musafir.test','legacy-hash','Legacy Cashier','cashier') RETURNING id",
    [org, branch]
  )).rows[0].id;

  const category = (await client.query(
    "INSERT INTO categories(organization_id, name) VALUES($1,'Burgers') RETURNING id", [org]
  )).rows[0].id;
  const product = (await client.query(
    "INSERT INTO products(organization_id, category_id, sku, name, price) VALUES($1,$2,'BRG-1','Zinger Burger',12.50) RETURNING id",
    [org, category]
  )).rows[0].id;
  const productTwo = (await client.query(
    "INSERT INTO products(organization_id, category_id, sku, name, price) VALUES($1,$2,'BRG-2','Beef Burger',15.00) RETURNING id",
    [org, category]
  )).rows[0].id;

  const ingredient = (await client.query(
    "INSERT INTO ingredients(organization_id, branch_id, sku, name, unit, stock, track_stock, reorder_level, unit_cost) VALUES($1,$2,'ING-1','Chicken Fillet','kg',42.5,true,10,18.75) RETURNING id",
    [org, branch]
  )).rows[0].id;
  await client.query(
    'INSERT INTO recipes(product_id, ingredient_id, quantity) VALUES($1,$2,0.150)', [product, ingredient]
  );

  const table = (await client.query(
    "INSERT INTO restaurant_tables(organization_id, branch_id, table_number, seats) VALUES($1,$2,'T-01',4) RETURNING id",
    [org, branch]
  )).rows[0].id;

  const customer = (await client.query(
    "INSERT INTO customers(organization_id, name, phone, loyalty_points) VALUES($1,'Karim Uddin','+966500000001',25) RETURNING id",
    [org]
  )).rows[0].id;

  const supplier = (await client.query(
    "INSERT INTO suppliers(organization_id, name, phone, category) VALUES($1,'Fresh Farm','+966500000002','Poultry') RETURNING id",
    [org]
  )).rows[0].id;

  // Two orders: one with microsecond timestamps, one that keeps NULLs.
  const order = (await client.query(
    `INSERT INTO orders(organization_id, branch_id, customer_id, order_number, order_type, status, subtotal, tax, discount, total, notes, created_by, created_at, table_id)
     VALUES($1,$2,$3,1001,'Dine-in','Completed',25.00,3.75,0,28.75,'legacy ticket',$4,'2026-01-05 18:42:11.123456+00',$5) RETURNING id`,
    [org, branch, customer, owner, table]
  )).rows[0].id;
  const orderTwo = (await client.query(
    `INSERT INTO orders(organization_id, branch_id, order_number, order_type, status, subtotal, tax, discount, total, created_by, created_at)
     VALUES($1,$2,1002,'Takeaway','Pending',15.00,2.25,0,17.25,$3,'2026-02-11 09:10:00.000001+00') RETURNING id`,
    [org, branch, cashier]
  )).rows[0].id;

  await client.query(
    `INSERT INTO order_items(order_id, product_id, product_name, quantity, unit_price, line_total)
     VALUES($1,$2,'Zinger Burger',2,12.50,25.00),($3,$4,'Beef Burger',1,15.00,15.00)`,
    [order, product, orderTwo, productTwo]
  );

  await client.query(
    `INSERT INTO payments(organization_id, branch_id, order_id, amount, method, direction, note, created_at)
     VALUES($1,$2,$3,28.75,'Cash','in','legacy order payment','2026-01-05 18:43:02.654321+00')`,
    [org, branch, order]
  );

  await client.query(
    `INSERT INTO purchases(organization_id, branch_id, supplier_id, invoice_number, total, paid, created_at)
     VALUES($1,$2,$3,$4,180.00,80.00,'2026-01-02 10:00:00.111222+00')`,
    [org, branch, supplier, clean ? 'INV-9001' : 'INV-9001']
  );

  const employee = (await client.query(
    "INSERT INTO employees(organization_id, branch_id, name, job_role, shift, monthly_salary) VALUES($1,$2,'Rafiq Islam','Chef','Morning',2500) RETURNING id",
    [org, branch]
  )).rows[0].id;

  await client.query(
    "INSERT INTO employee_attendance(employee_id, organization_id, branch_id, attendance_date, status) VALUES($1,$2,$3,'2026-01-05','Present')",
    [employee, org, branch]
  );
  await client.query(
    `INSERT INTO payroll_records(employee_id, organization_id, branch_id, period, base_salary, bonus, deduction, advance_deduction, net_salary, other_deduction, deduction_note)
     VALUES($1,$2,$3,'2026-01','2500.00',0,0,0,2500.00,0,'')`,
    [employee, org, branch]
  );

  await client.query(
    `INSERT INTO expenses(organization_id, branch_id, category, description, amount, payment_method, expense_date)
     VALUES($1,$2,'Utilities','Electricity','450.00','Cash','2026-01-31')`,
    [org, branch]
  );

  await client.query(
    "INSERT INTO deliveries(organization_id, branch_id, order_id, status, delivery_address) VALUES($1,$2,$3,'Pending','Madinah, KSA')",
    [org, branch, orderTwo]
  );

  await client.query(
    "INSERT INTO audit_logs(organization_id, branch_id, user_id, action, entity_type, entity_id, details) VALUES($1,$2,$3,'order.created','order',$4,'{\"legacy\":true}')",
    [org, branch, owner, order]
  );

  await client.query('COMMIT');

  // ---- planted problems (outside the transaction so DDL is allowed) ---------
  if (!clean) {
    // 1. A legacy-only table the Neon schema does not know about.
    await client.query('CREATE TABLE IF NOT EXISTS legacy_import_queue (id integer PRIMARY KEY, payload text)');
    await client.query("INSERT INTO legacy_import_queue(id, payload) VALUES (1, 'unmapped legacy data')");

    // 2. A legacy column the Neon schema never had.
    await client.query("ALTER TABLE products ADD COLUMN legacy_banner text NOT NULL DEFAULT 'old-shop'");

    // 3. Duplicate supplier names are fine, but duplicate invoice numbers among
    //    the same organization are not: they collide with UNIQUE(organization_id, invoice_number).
    //    (Handled by seeding a second purchase in the test that needs it.)
  }

  const tables = ['organizations', 'branches', 'users', 'categories', 'products', 'ingredients', 'recipes',
    'restaurant_tables', 'customers', 'suppliers', 'orders', 'order_items', 'payments', 'purchases',
    'stock_movements', 'audit_logs', 'expenses', 'employees', 'employee_attendance', 'salary_advances',
    'payroll_records', 'payroll_payments', 'reservations', 'deliveries'];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM ' + table);
    counts[table] = Number(result.rows[0].count);
  }

  return {
    ids: { organization: org, branch, owner, cashier, category, product, productTwo, ingredient, table, customer, supplier, order, orderTwo },
    counts
  };
}

/**
 * Add two purchases sharing an invoice number: the classic duplicate conflict.
 *
 * Older Render deployments enforced invoice uniqueness in the application rather
 * than the database, so the fixture drops the constraint to model that schema.
 */
export async function seedDuplicateInvoices(client: Client, ids: SeedResult['ids']): Promise<void> {
  await client.query(
    'ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_organization_id_invoice_number_key'
  );
  await client.query(
    `INSERT INTO purchases(organization_id, branch_id, supplier_id, invoice_number, total, paid)
     VALUES($1,$2,$3,'INV-DUP',50.00,0)`,
    [ids.organization, ids.branch, ids.supplier]
  );
  await client.query(
    `INSERT INTO purchases(organization_id, branch_id, supplier_id, invoice_number, total, paid)
     VALUES($1,$2,$3,'INV-DUP',75.00,0)`,
    [ids.organization, ids.branch, ids.supplier]
  );
}
