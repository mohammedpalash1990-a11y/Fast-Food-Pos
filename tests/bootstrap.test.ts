import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';

const isolatedDbPath = resolve(process.cwd(), 'data/test-isolated-bootstrap.db');

import { bootstrapProductionAdmin, db, ensureSeeded, initSchema } from '../server/db.js';
import { app } from '../server/index.js';

describe('Production Admin Bootstrap unit tests', () => {
  before(() => {
    initSchema();
  });

  after(() => {
    try {
      rmSync(isolatedDbPath, { force: true });
      rmSync(`${isolatedDbPath}-shm`, { force: true });
      rmSync(`${isolatedDbPath}-wal`, { force: true });
    } catch {
      // ignore
    }
  });

  test('test suite preserves real data/pos.db and never deletes it', () => {
    assert.notEqual(process.env.SQLITE_PATH, 'data/pos.db');
    assert.match(process.env.SQLITE_PATH || '', /test-isolated/);
  });

  test('bootstrap fails gracefully if BOOTSTRAP_ADMIN_EMAIL or PASSWORD missing', () => {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const res = bootstrapProductionAdmin();
    assert.equal(res.bootstrapped, false);
    assert.match(res.reason || '', /not set/);
  });

  test('bootstrap rejects invalid email format', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'not-an-email';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'ValidPassword123!';
    assert.throws(() => bootstrapProductionAdmin(), /valid email/);
  });

  test('bootstrap rejects weak password shorter than 12 chars', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'owner@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'short';
    assert.throws(() => bootstrapProductionAdmin(), /12–128 characters/);
  });

  test('bootstrap defaults are Saudi/neutral and respect environment configuration', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'prod-owner@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'SuperSecurePassword2026!';
    delete process.env.BOOTSTRAP_RESTAURANT_NAME;
    delete process.env.BOOTSTRAP_BRANCH_NAME;
    delete process.env.BOOTSTRAP_BRANCH_CODE;
    delete process.env.BOOTSTRAP_CURRENCY;
    delete process.env.BOOTSTRAP_TAX_RATE;

    const res = bootstrapProductionAdmin();
    assert.equal(res.bootstrapped, true);

    const user = db.prepare('SELECT id, email, role, display_name, password_hash FROM users WHERE email = ?').get('prod-owner@example.com') as Record<string, unknown>;
    assert.ok(user, 'User must exist in database');
    assert.equal(user.email, 'prod-owner@example.com');
    assert.equal(user.role, 'owner');
    assert.equal(bcrypt.compareSync('SuperSecurePassword2026!', String(user.password_hash)), true);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    assert.ok(settings, 'Settings row must exist');
    assert.equal(settings.restaurant_name, 'Musafir Fast Food');
    assert.equal(settings.branch_name, 'Main Branch');
    assert.equal(settings.branch_code, 'KSA-01');
    assert.equal(settings.currency, 'SAR');
    assert.equal(settings.tax_rate, 15);
    assert.equal(settings.phone, '+966 50 000 0000');
    assert.equal(settings.address, 'King Fahd Road, Riyadh');
  });

  test('bootstrap idempotency preserves existing organization and branch settings without overwriting', () => {
    // Attempting re-bootstrap with different parameters must NOT overwrite the existing row
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'prod-owner@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'DifferentNewPassword2026!';
    process.env.BOOTSTRAP_RESTAURANT_NAME = 'Overwritten Restaurant';
    process.env.BOOTSTRAP_BRANCH_NAME = 'Overwritten Branch';

    const res = bootstrapProductionAdmin();
    assert.equal(res.bootstrapped, false);
    assert.match(res.reason || '', /already exists/);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    assert.equal(settings.restaurant_name, 'Musafir Fast Food');
    assert.equal(settings.branch_name, 'Main Branch');
    assert.equal(settings.currency, 'SAR');

    // Original password must still be valid
    const user = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('prod-owner@example.com') as Record<string, unknown>;
    assert.equal(bcrypt.compareSync('SuperSecurePassword2026!', String(user.password_hash)), true);
    assert.equal(bcrypt.compareSync('DifferentNewPassword2026!', String(user.password_hash)), false);
  });

  test('ensureSeeded() in production mode does not insert demo products, demo users or dummy orders', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      ensureSeeded();
      const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
      assert.equal(productCount, 0, 'No demo products should be inserted in production');
      const orderCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
      assert.equal(orderCount, 0, 'No dummy orders should be inserted in production');
      const demoUser = db.prepare("SELECT id FROM users WHERE email = 'admin@musafir.local'").get();
      assert.equal(demoUser, undefined, 'Demo admin user should not be seeded in production');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

describe('Production Owner API authentication, JWT safety, and branch operations', () => {
  let server: Server;
  let API: string;
  let ownerToken: string;

  before(async () => {
    await new Promise<void>((resolvePromise) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          API = `http://127.0.0.1:${address.port}`;
        }
        resolvePromise();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    }
  });

  test('server fails safely on startup if JWT_SECRET is missing or less than 32 characters', async () => {
    const { spawnSync } = await import('node:child_process');
    const childMissing = spawnSync('npx', ['tsx', '-e', 'import("./server/index.js")'], {
      env: { ...process.env, JWT_SECRET: '', TEST_MODE: '1' }
    });
    assert.notEqual(childMissing.status, 0);
    assert.match(childMissing.stderr.toString(), /JWT_SECRET must be set to at least 32 characters/);

    const childShort = spawnSync('npx', ['tsx', '-e', 'import("./server/index.js")'], {
      env: { ...process.env, JWT_SECRET: 'short-secret-under-32-chars', TEST_MODE: '1' }
    });
    assert.notEqual(childShort.status, 0);
    assert.match(childShort.stderr.toString(), /JWT_SECRET must be set to at least 32 characters/);
  });

  test('owner login with bootstrapped credentials returns valid JWT', async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'prod-owner@example.com',
        password: 'SuperSecurePassword2026!'
      })
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; user: { role: string; email: string } };
    assert.ok(body.token, 'Should return a JWT token');
    assert.equal(body.user.role, 'owner');
    assert.equal(body.user.email, 'prod-owner@example.com');
    ownerToken = body.token;
  });

  test('validate bearer token with GET /api/auth/me', async () => {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { user: { role: string; email: string } };
    assert.equal(body.user.email, 'prod-owner@example.com');
    assert.equal(body.user.role, 'owner');
  });

  test('reject invalid or unauthenticated requests to /api/auth/me', async () => {
    const resNoAuth = await fetch(`${API}/api/auth/me`);
    assert.equal(resNoAuth.status, 401);

    const resInvalid = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.token' }
    });
    assert.equal(resInvalid.status, 401);
  });

  test('owner can configure organization and branch details via PUT /api/settings', async () => {
    const updateRes = await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        restaurantName: 'Musafir Prime Dining',
        branchName: 'Riyadh Olaya Branch',
        branchCode: 'RUH-01',
        phone: '+966 50 123 4567',
        address: 'Olaya Street, Riyadh',
        currency: 'SAR',
        taxRate: 15,
        receiptFooter: 'Welcome to Musafir Prime!',
        publicMenuUrl: 'https://prime.musafir.sa/menu'
      })
    });

    assert.equal(updateRes.status, 200);
    const body = (await updateRes.json()) as { settings: Record<string, unknown> };
    assert.equal(body.settings.restaurantName, 'Musafir Prime Dining');
    assert.equal(body.settings.branchName, 'Riyadh Olaya Branch');
    assert.equal(body.settings.branchCode, 'RUH-01');
    assert.equal(body.settings.taxRate, 15);
    assert.equal(body.settings.currency, 'SAR');

    // Verify GET /api/settings
    const getRes = await fetch(`${API}/api/settings`);
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as { settings: Record<string, unknown> };
    assert.equal(getBody.settings.branchCode, 'RUH-01');
    assert.equal(getBody.settings.restaurantName, 'Musafir Prime Dining');
  });

  test('owner can create a new staff account via POST /api/users', async () => {
    const res = await fetch(`${API}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        displayName: 'Branch Manager Tariq',
        email: 'tariq.branch@example.com',
        role: 'manager',
        password: 'ManagerPassword123!'
      })
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as { user: { email: string; role: string } };
    assert.equal(body.user.email, 'tariq.branch@example.com');
    assert.equal(body.user.role, 'manager');
  });

  test('non-owner cannot modify organization/branch settings', async () => {
    // Login as the manager we just created
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tariq.branch@example.com',
        password: 'ManagerPassword123!'
      })
    });
    assert.equal(loginRes.status, 200);
    const { token: managerToken } = (await loginRes.json()) as { token: string };

    const updateRes = await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({
        restaurantName: 'Hacked Name',
        branchName: 'Hacked Branch'
      })
    });

    assert.equal(updateRes.status, 403);
  });
});
