// PostgreSQL integration coverage for supplier purchases, inventory valuation and expenses.
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
type Reply = { status: number; body: any };

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Reply> {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let parsed: any = null;
  try { parsed = await response.json(); } catch { /* empty response */ }
  return { status: response.status, body: parsed };
}

before(async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const health = await fetch(API + '/api/health'); if (health.ok) break; } catch { /* API is starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (attempt === 39) throw new Error('API did not become healthy at ' + API);
  }

  const org = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Purchase IT ' + suffix, 'purchase-it-' + suffix])).rows[0].id;
  const branch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [org, 'Main', 'PUR-' + suffix])).rows[0].id;
  const otherBranch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [org, 'Other', 'PUR2-' + suffix])).rows[0].id;
  const owner = (await db.query(
    'INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [org, branch, 'owner-' + suffix + '@it.local', await bcrypt.hash('Purchase-IT-Pass-1', 4), 'Purchase IT Owner', 'owner']
  )).rows[0].id;
  const cashier = (await db.query(
    'INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [org, branch, 'cashier-' + suffix + '@it.local', await bcrypt.hash('Purchase-IT-Pass-1', 4), 'Purchase IT Cashier', 'cashier']
  )).rows[0].id;
  const ingredient = (await db.query(
    'INSERT INTO ingredients(organization_id,branch_id,sku,name,unit,stock,track_stock,unit_cost) VALUES($1,$2,$3,$4,$5,10,true,2) RETURNING id',
    [org, branch, 'ING-' + suffix, 'Test Flour', 'kg']
  )).rows[0].id;
  const foreignIngredient = (await db.query(
    'INSERT INTO ingredients(organization_id,branch_id,sku,name,unit,stock,track_stock,unit_cost) VALUES($1,$2,$3,$4,$5,5,true,1) RETURNING id',
    [org, otherBranch, 'FOREIGN-' + suffix, 'Other Branch Flour', 'kg']
  )).rows[0].id;
  tokens.owner = jwt.sign({ sub: owner }, process.env.JWT_SECRET!, { expiresIn: '8h', issuer: 'musafir-pos' });
  tokens.cashier = jwt.sign({ sub: cashier }, process.env.JWT_SECRET!, { expiresIn: '8h', issuer: 'musafir-pos' });
  Object.assign(ids, { org, branch, otherBranch, owner, cashier, ingredient, foreignIngredient });
});

after(async () => {
  if (ids.org) {
    await db.query('DELETE FROM purchase_payment_allocations WHERE purchase_id IN (SELECT id FROM purchases WHERE organization_id=$1)', [ids.org]);
    await db.query('DELETE FROM payments WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE organization_id=$1)', [ids.org]);
    await db.query('DELETE FROM purchases WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM expenses WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM stock_movements WHERE branch_id=ANY($1::uuid[])', [[ids.branch, ids.otherBranch]]);
    await db.query('DELETE FROM audit_logs WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM suppliers WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM ingredients WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM users WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM branches WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM organizations WHERE id=$1', [ids.org]);
  }
  await db.end();
});

test('purchase receiving increases branch stock and records supplier payment allocation', async () => {
  const supplier = await call('POST', '/api/suppliers', tokens.owner, { name: 'Test Supplier ' + suffix, phone: '555-' + suffix, category: 'Dry goods' });
  assert.equal(supplier.status, 201, JSON.stringify(supplier.body));
  ids.supplier = supplier.body.supplier.id;

  const purchase = await call('POST', '/api/purchases', tokens.owner, {
    supplierId: ids.supplier, invoiceNumber: 'INV-' + suffix, paid: 5, paymentMethod: 'Mada',
    items: [{ ingredientId: ids.ingredient, quantity: 4, unitCost: 3 }]
  });
  assert.equal(purchase.status, 201, JSON.stringify(purchase.body));
  ids.purchase = purchase.body.purchase.id;
  assert.equal(Number(purchase.body.purchase.total), 12);
  assert.equal(Number(purchase.body.purchase.paid), 5);

  const stock = await db.query('SELECT stock,unit_cost FROM ingredients WHERE id=$1', [ids.ingredient]);
  assert.equal(Number(stock.rows[0].stock), 14);
  assert.equal(Number(stock.rows[0].unit_cost), 3);
  const movement = await db.query("SELECT quantity_delta FROM stock_movements WHERE reference_id=$1 AND movement_type='purchase'", [ids.purchase]);
  assert.equal(movement.rowCount, 1);
  assert.equal(Number(movement.rows[0].quantity_delta), 4);

  const allocation = await db.query(
    'SELECT a.amount,p.amount AS payment_amount,p.method,p.direction FROM purchase_payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE a.purchase_id=$1',
    [ids.purchase]
  );
  assert.equal(allocation.rowCount, 1);
  assert.equal(Number(allocation.rows[0].amount), 5);
  assert.equal(Number(allocation.rows[0].payment_amount), 5);
  assert.equal(allocation.rows[0].method, 'Mada');
  assert.equal(allocation.rows[0].direction, 'out');

  const supplierList = await call('GET', '/api/suppliers', tokens.owner);
  assert.equal(Number(supplierList.body.suppliers.find((row: any) => row.id === ids.supplier).payable), 7);
  const purchaseList = await call('GET', '/api/purchases', tokens.owner);
  assert.ok(purchaseList.body.purchases.some((row: any) => row.id === ids.purchase));
});

test('purchase validation and branch scope reject overpayment, foreign-branch stock and cashier writes', async () => {
  assert.equal((await call('POST', '/api/purchases', tokens.owner, {
    supplierId: ids.supplier, invoiceNumber: 'OVER-' + suffix, paid: 99, items: [{ ingredientId: ids.ingredient, quantity: 1, unitCost: 1 }]
  })).status, 400);
  assert.equal((await call('POST', '/api/purchases', tokens.cashier, {
    supplierId: ids.supplier, invoiceNumber: 'CASH-' + suffix, paid: 0, items: [{ ingredientId: ids.ingredient, quantity: 1, unitCost: 1 }]
  })).status, 403);
  assert.equal((await call('POST', '/api/purchases', tokens.owner, {
    supplierId: ids.supplier, invoiceNumber: 'BRANCH-' + suffix, paid: 0, items: [{ ingredientId: ids.foreignIngredient, quantity: 1, unitCost: 1 }]
  })).status, 404);
  const count = await db.query('SELECT count(*)::int AS total FROM purchases WHERE organization_id=$1', [ids.org]);
  assert.equal(count.rows[0].total, 1);
});

test('expenses are branch-scoped, validated, audited and listed with Cash or Mada method', async () => {
  const created = await call('POST', '/api/expenses', tokens.owner, {
    category: 'Utilities', description: 'Integration test electricity', amount: 25.5, paymentMethod: 'Cash', date: '2026-11-08'
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  ids.expense = created.body.expense.id;
  assert.equal(Number(created.body.expense.amount), 25.5);
  assert.equal(created.body.expense.paymentMethod, 'Cash');
  assert.equal((await call('POST', '/api/expenses', tokens.cashier, {
    category: 'Utilities', description: 'Forbidden', amount: 1, paymentMethod: 'Mada', date: '2026-11-08'
  })).status, 403);
  assert.equal((await call('POST', '/api/expenses', tokens.owner, {
    category: 'Utilities', description: 'Invalid method', amount: 1, paymentMethod: 'Card', date: '2026-11-08'
  })).status, 400);
  assert.equal((await call('POST', '/api/expenses', tokens.owner, {
    category: 'Utilities', description: 'Invalid date', amount: 1, paymentMethod: 'Mada', date: '08-11-2026'
  })).status, 400);

  const list = await call('GET', '/api/expenses', tokens.owner);
  assert.equal(list.status, 200);
  assert.ok(list.body.expenses.some((row: any) => row.id === ids.expense));
  const audit = await db.query("SELECT count(*)::int AS total FROM audit_logs WHERE entity_id=$1 AND action='expense.created' AND organization_id=$2", [ids.expense, ids.org]);
  assert.equal(audit.rows[0].total, 1);
});
