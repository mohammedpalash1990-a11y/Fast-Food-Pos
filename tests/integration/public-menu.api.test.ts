// Public customer QR menu API (B7) against real PostgreSQL and the running API.
// The endpoint is unauthenticated by design, so these tests also prove that it
// exposes nothing but the active menu of the requested branch.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const API = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const suffix = randomUUID().slice(0, 8);
const ids: Record<string, string> = {};
const names: Record<string, string> = {};

before(async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await fetch(API + '/api/health');
      if (health.ok) break;
    } catch { /* API is starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (attempt === 39) throw new Error('API did not become healthy at ' + API);
  }

  const org = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Menu IT ' + suffix, 'menu-it-' + suffix])).rows[0].id;
  const branch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [org, 'Main Branch', 'MENU-' + suffix])).rows[0].id;
  const otherOrg = (await db.query('INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id', ['Menu Other ' + suffix, 'menu-other-' + suffix])).rows[0].id;
  const otherBranch = (await db.query('INSERT INTO branches(organization_id,name,code) VALUES($1,$2,$3) RETURNING id', [otherOrg, 'Other Branch', 'MENU2-' + suffix])).rows[0].id;
  Object.assign(ids, { org, branch, otherOrg, otherBranch });

  const burgers = (await db.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING id', [org, 'Burgers'])).rows[0].id;
  const drinks = (await db.query('INSERT INTO categories(organization_id,name) VALUES($1,$2) RETURNING id', [org, 'Drinks'])).rows[0].id;

  names.activeBurger = 'Menu Burger ' + suffix;
  names.activeCola = 'Menu Cola ' + suffix;
  names.inactive = 'Retired Item ' + suffix;
  names.foreign = 'Foreign Item ' + suffix;

  await db.query(
    `INSERT INTO products(organization_id,category_id,sku,name,description,price,active) VALUES
     ($1,$2,$3,$4,'Charcoal grilled',22,true),
     ($1,$5,$6,$7,'Ice cold',5,true),
     ($1,$2,$8,$9,'No longer sold',15,false)`,
    [org, burgers, 'MENU-B-' + suffix, names.activeBurger, drinks, 'MENU-C-' + suffix, names.activeCola, 'MENU-X-' + suffix, names.inactive]
  );
  await db.query(
    'INSERT INTO products(organization_id,sku,name,price,active) VALUES($1,$2,$3,9,true)',
    [otherOrg, 'MENU-F-' + suffix, names.foreign]
  );
});

after(async () => { await db.end(); });

test('the public menu needs no authentication and lists only active products', async () => {
  const response = await fetch(`${API}/api/menu?branchId=${ids.branch}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');

  const text = await response.text();
  assert.doesNotMatch(text, /password|password_hash|token/i);

  const body = JSON.parse(text);
  assert.equal(body.branch.id, ids.branch);
  assert.equal(body.branch.name, 'Main Branch');
  assert.equal(body.branch.organizationName, 'Menu IT ' + suffix);
  assert.equal(body.productCount, 2);
  assert.equal(body.products.length, 2);

  const productNames = body.products.map((product: any) => product.name).sort();
  assert.deepEqual(productNames, [names.activeBurger, names.activeCola].sort());
  assert.equal(productNames.includes(names.inactive), false);
  assert.equal(productNames.includes(names.foreign), false);

  assert.deepEqual(body.categories, ['Burgers', 'Drinks']);
  const burger = body.products.find((product: any) => product.name === names.activeBurger);
  assert.equal(burger.category, 'Burgers');
  assert.equal(burger.description, 'Charcoal grilled');
  assert.equal(Number(burger.price), 22);
  assert.ok(typeof body.generatedAt === 'string');
});

test('each branch resolves its own organization menu', async () => {
  const response = await fetch(`${API}/api/menu?branchId=${ids.otherBranch}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.branch.name, 'Other Branch');
  assert.deepEqual(body.products.map((product: any) => product.name), [names.foreign]);
});

test('the public menu rejects missing, malformed and unknown branches', async () => {
  const missing = await fetch(`${API}/api/menu`);
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /branchId/);

  const malformed = await fetch(`${API}/api/menu?branchId=not-a-uuid`);
  assert.equal(malformed.status, 400);

  const unknown = await fetch(`${API}/api/menu?branchId=${randomUUID()}`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, 'Branch not found');
});

test('the QR endpoint returns an edge-compatible SVG for a branch', async () => {
  const response = await fetch(`${API}/api/menu/qr?branchId=${ids.branch}&table=12`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /image\/svg\+xml/);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const svg = await response.text();
  assert.match(svg, /^<\?xml|^<svg/);
  assert.match(svg, /<svg[\s>]/);
  assert.match(svg, /branch%3D|branch=/);
  assert.match(svg, /table%3D|table=/);
});

test('the QR endpoint validates its branch', async () => {
  const missing = await fetch(`${API}/api/menu/qr`);
  assert.equal(missing.status, 400);

  const unknown = await fetch(`${API}/api/menu/qr?branchId=${randomUUID()}`);
  assert.equal(unknown.status, 404);
});
