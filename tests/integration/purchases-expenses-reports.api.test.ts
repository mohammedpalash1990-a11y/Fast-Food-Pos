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
let token = '';
const today = new Date().toISOString().slice(0, 10);

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let parsed: any = null;
  try { parsed = await response.json(); } catch { /* empty response */ }
  return { status: response.status, body: parsed };
}

before(async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(API + '/api/health')).ok) break; } catch { /* API starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (attempt === 39) throw new Error('API did not become healthy at ' + API);
  }
  ids.org = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Purchase QA ' + suffix, 'purchase-qa-' + suffix])).rows[0].id;
  ids.branch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [ids.org, 'QA Branch', 'QA-' + suffix])).rows[0].id;
  ids.user = (await db.query('INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [ids.org, ids.branch, 'purchase-' + suffix + '@it.local', await bcrypt.hash('Purchase-QA-Pass-1', 4), 'Purchase QA', 'owner'])).rows[0].id;
  ids.supplier = (await db.query('INSERT INTO suppliers(organization_id,name,phone,category) VALUES($1,$2,$3,$4) RETURNING id', [ids.org, 'QA Supplier ' + suffix, '', 'Ingredients'])).rows[0].id;
  ids.ingredient = (await db.query('INSERT INTO ingredients(organization_id,branch_id,sku,name,category,unit,stock,track_stock,unit_cost) VALUES($1,$2,$3,$4,$5,$6,10,true,2) RETURNING id', [ids.org, ids.branch, 'QA-' + suffix, 'QA Flour', 'Dry goods', 'kg'])).rows[0].id;
  token = jwt.sign({ sub: ids.user }, process.env.JWT_SECRET!, { expiresIn: '8h', issuer: 'musafir-pos' });
});

after(async () => {
  if (ids.org) {
    await db.query('DELETE FROM audit_logs WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM purchase_payment_allocations WHERE purchase_id IN (SELECT id FROM purchases WHERE organization_id=$1)', [ids.org]);
    await db.query('DELETE FROM payments WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE organization_id=$1)', [ids.org]);
    await db.query('DELETE FROM purchases WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM expenses WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM stock_movements WHERE branch_id=$1', [ids.branch]);
    await db.query('DELETE FROM ingredients WHERE branch_id=$1', [ids.branch]);
    await db.query('DELETE FROM suppliers WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM users WHERE organization_id=$1', [ids.org]);
    await db.query('DELETE FROM branches WHERE id=$1', [ids.branch]);
    await db.query('DELETE FROM organizations WHERE id=$1', [ids.org]);
  }
  await db.end();
});

test('purchase receiving, supplier settlement, expense recording and financial report reconcile', async () => {
  const purchase = await call('POST', '/api/purchases', {
    supplierId: ids.supplier, invoiceNumber: 'QA-' + suffix, paid: 20, paymentMethod: 'Mada',
    items: [{ ingredientId: ids.ingredient, quantity: 10, unitCost: 4 }]
  });
  assert.equal(purchase.status, 201, JSON.stringify(purchase.body));
  assert.equal(Number(purchase.body.purchase.total), 40);
  assert.equal(Number(purchase.body.purchase.paid), 20);

  const stock = await db.query('SELECT stock,unit_cost FROM ingredients WHERE id=$1', [ids.ingredient]);
  assert.equal(Number(stock.rows[0].stock), 20);
  assert.equal(Number(stock.rows[0].unit_cost), 4);
  const movement = await db.query("SELECT quantity_delta FROM stock_movements WHERE reference_id=$1 AND movement_type='purchase'", [purchase.body.purchase.id]);
  assert.equal(movement.rowCount, 1);
  assert.equal(Number(movement.rows[0].quantity_delta), 10);

  const supplierPayment = await call('POST', '/api/suppliers/' + ids.supplier + '/payments', { amount: 20, method: 'Cash', note: 'QA settlement' });
  assert.equal(supplierPayment.status, 201, JSON.stringify(supplierPayment.body));
  const payable = await db.query('SELECT paid,total FROM purchases WHERE id=$1', [purchase.body.purchase.id]);
  assert.equal(Number(payable.rows[0].paid), 40);
  assert.equal(Number(payable.rows[0].total) - Number(payable.rows[0].paid), 0);

  const expense = await call('POST', '/api/expenses', { category: 'Utilities', description: 'QA electricity', amount: 12.5, paymentMethod: 'Cash', date: today });
  assert.equal(expense.status, 201, JSON.stringify(expense.body));
  const expenses = await call('GET', '/api/expenses');
  assert.equal(expenses.status, 200);
  assert.ok(expenses.body.expenses.some((row: any) => row.id === expense.body.expense.id));

  const report = await call('GET', '/api/reports/summary?from=' + today + '&to=' + today);
  assert.equal(report.status, 200, JSON.stringify(report.body));
  assert.equal(report.body.period.from, today);
  assert.equal(Number(report.body.expenses.total), 12.5);
  assert.equal(Number(report.body.purchases.total), 40);
  assert.equal(Number(report.body.purchases.paid), 40);
  assert.equal(Number(report.body.purchases.outstanding), 0);
  assert.equal(Number(report.body.operatingOutflow), 52.5);

  const invalidRange = await call('GET', '/api/reports/summary?from=2026-11-09&to=2026-11-08');
  assert.equal(invalidRange.status, 400);
  const unsupportedPayment = await call('POST', '/api/expenses', { category: 'Other', description: 'Invalid method', amount: 1, paymentMethod: 'Card', date: today });
  assert.equal(unsupportedPayment.status, 400);
});
