// Core POS checkout integration tests against real PostgreSQL and the running API.
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

type Reply = { status: number; body: any };
async function call(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<Reply> {
  const response = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let parsed: any = null;
  try { parsed = await response.json(); } catch { /* empty response */ }
  return { status: response.status, body: parsed };
}

async function createOrder(orderType: 'Dine-in' | 'Takeaway' | 'Pickup' | 'Home Delivery', paymentMethod: 'Cash' | 'Mada', extra: Record<string, unknown> = {}) {
  return call('POST', '/api/orders', {
    orderType,
    paymentMethod,
    taxRate: 0.15,
    items: [{ productId: ids.product, quantity: 1 }],
    ...extra
  });
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

  const org = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['POS IT ' + suffix, 'pos-it-' + suffix])).rows[0].id;
  const branch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [org, 'Main', 'POS-' + suffix])).rows[0].id;
  const user = (await db.query(
    'INSERT INTO users(organization_id,branch_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [org, branch, 'pos-' + suffix + '@it.local', await bcrypt.hash('POS-Integration-Pass-1', 4), 'POS Integration', 'owner']
  )).rows[0].id;
  const category = (await db.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING id', [org, 'Test Meals'])).rows[0].id;
  const product = (await db.query(
    'INSERT INTO products(organization_id,category_id,sku,name,price) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [org, category, 'POS-' + suffix, 'Test Burger', 20]
  )).rows[0].id;
  const ingredient = (await db.query(
    'INSERT INTO ingredients(organization_id,branch_id,sku,name,unit,stock,track_stock) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING id',
    [org, branch, 'ING-' + suffix, 'Burger Patty', 'piece', 100]
  )).rows[0].id;
  await db.query('INSERT INTO recipes(product_id,ingredient_id,quantity) VALUES($1,$2,$3)', [product, ingredient, 1]);

  ids.org = org;
  ids.branch = branch;
  ids.user = user;
  ids.product = product;
  ids.ingredient = ingredient;
  token = jwt.sign({ sub: user }, process.env.JWT_SECRET!, { expiresIn: '8h', issuer: 'musafir-pos' });

  const table = await call('POST', '/api/tables', { tableNumber: 'T-' + suffix, seats: 2 });
  assert.equal(table.status, 201, JSON.stringify(table.body));
  ids.table = table.body.table.id;
});

after(async () => {
  if (ids.org) {
    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM payments WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM stock_movements WHERE branch_id=$1', [ids.branch]);
      await db.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE organization_id=$1)', [ids.org]);
      await db.query('DELETE FROM orders WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM recipes WHERE product_id=$1', [ids.product]);
      await db.query('DELETE FROM restaurant_tables WHERE branch_id=$1', [ids.branch]);
      await db.query('DELETE FROM products WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM ingredients WHERE branch_id=$1', [ids.branch]);
      await db.query('DELETE FROM audit_logs WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM users WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM categories WHERE organization_id=$1', [ids.org]);
      await db.query('DELETE FROM branches WHERE id=$1', [ids.branch]);
      await db.query('DELETE FROM organizations WHERE id=$1', [ids.org]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
  await db.end();
});

test('all four order types create paid orders with only Cash or Mada and deduct recipe stock', async () => {
  const cases: Array<['Dine-in' | 'Takeaway' | 'Pickup' | 'Home Delivery', 'Cash' | 'Mada', Record<string, unknown>]> = [
    ['Dine-in', 'Cash', { tableId: ids.table }],
    ['Takeaway', 'Mada', {}],
    ['Pickup', 'Cash', {}],
    ['Home Delivery', 'Mada', {}]
  ];

  for (const [orderType, paymentMethod, extra] of cases) {
    const result = await createOrder(orderType, paymentMethod, extra);
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const orderId = result.body.order.id;
    const order = (await db.query('SELECT order_type,total,status FROM orders WHERE id=$1', [orderId])).rows[0];
    assert.equal(order.order_type, orderType);
    assert.equal(order.status, 'Pending');
    assert.equal(Number(order.total), 23);
    const payments = await db.query('SELECT amount,method,direction FROM payments WHERE order_id=$1', [orderId]);
    assert.equal(payments.rowCount, 1);
    assert.equal(Number(payments.rows[0].amount), Number(order.total));
    assert.equal(payments.rows[0].method, paymentMethod);
    assert.equal(payments.rows[0].direction, 'in');
  }

  const stock = await db.query('SELECT stock FROM ingredients WHERE id=$1', [ids.ingredient]);
  assert.equal(Number(stock.rows[0].stock), 96);
  const movements = await db.query("SELECT count(*)::int AS count FROM stock_movements WHERE branch_id=$1 AND movement_type='sale'", [ids.branch]);
  assert.equal(movements.rows[0].count, 4);
});

test('dine-in table rules, invalid payment methods, insufficient stock and idempotent checkout are enforced', async () => {
  const missingTable = await createOrder('Dine-in', 'Cash');
  assert.equal(missingTable.status, 400);

  const wrongTableType = await createOrder('Pickup', 'Cash', { tableId: ids.table });
  assert.equal(wrongTableType.status, 400);

  const unsupportedPayment = await call('POST', '/api/orders', {
    orderType: 'Takeaway',
    paymentMethod: 'Card',
    taxRate: 0.15,
    items: [{ productId: ids.product, quantity: 1 }]
  });
  assert.equal(unsupportedPayment.status, 400);

  const key = 'pos-it-' + suffix + '-once';
  const first = await createOrder('Takeaway', 'Mada', {}, key);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const replay = await createOrder('Takeaway', 'Mada', {}, key);
  assert.equal(replay.status, 201, JSON.stringify(replay.body));
  assert.equal(replay.body.order.id, first.body.order.id);
  const duplicateCount = await db.query('SELECT count(*)::int AS count FROM orders WHERE branch_id=$1 AND idempotency_key=$2', [ids.branch, key]);
  assert.equal(duplicateCount.rows[0].count, 1);

  const conflict = await call('POST', '/api/orders', {
    orderType: 'Takeaway',
    paymentMethod: 'Cash',
    taxRate: 0.15,
    items: [{ productId: ids.product, quantity: 2 }]
  }, key);
  assert.equal(conflict.status, 409);

  await db.query('UPDATE ingredients SET stock=0 WHERE id=$1', [ids.ingredient]);
  const before = await db.query('SELECT count(*)::int AS count FROM orders WHERE organization_id=$1', [ids.org]);
  const rejected = await createOrder('Pickup', 'Cash');
  assert.equal(rejected.status, 409);
  const afterCount = await db.query('SELECT count(*)::int AS count FROM orders WHERE organization_id=$1', [ids.org]);
  assert.equal(afterCount.rows[0].count, before.rows[0].count);
});
