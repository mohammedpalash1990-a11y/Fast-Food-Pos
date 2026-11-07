import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';

const testDbPath = resolve(process.cwd(), 'data/pos.db');

// Reset pos.db for test run
try {
  rmSync(testDbPath, { force: true });
} catch {
  // ignore
}

process.env.NODE_ENV = 'test';
process.env.PORT = '3099';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-long-bootstrap-suite';

import { bootstrapProductionAdmin, db, initSchema } from '../server/db.js';
import { app } from '../server/index.js';

describe('Production Admin Bootstrap unit tests', () => {
  before(() => {
    initSchema();
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

  test('bootstrap succeeds with valid credentials and sets up owner & organization/branch', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'prod-owner@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'SuperSecurePassword2026!';
    process.env.BOOTSTRAP_RESTAURANT_NAME = 'Musafir Global HQ';
    process.env.BOOTSTRAP_BRANCH_NAME = 'Sylhet City Branch';
    process.env.BOOTSTRAP_BRANCH_CODE = 'SYL-01';

    const res = bootstrapProductionAdmin();
    assert.equal(res.bootstrapped, true);

    const user = db.prepare('SELECT id, email, role, display_name, password_hash FROM users WHERE email = ?').get('prod-owner@example.com') as Record<string, unknown>;
    assert.ok(user, 'User must exist in database');
    assert.equal(user.email, 'prod-owner@example.com');
    assert.equal(user.role, 'owner');
    assert.equal(bcrypt.compareSync('SuperSecurePassword2026!', String(user.password_hash)), true);

    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<string, unknown>;
    assert.ok(settings, 'Settings row must exist');
    assert.equal(settings.restaurant_name, 'Musafir Global HQ');
    assert.equal(settings.branch_name, 'Sylhet City Branch');
    assert.equal(settings.branch_code, 'SYL-01');
  });

  test('bootstrap is idempotent and does not overwrite existing owner password', () => {
    process.env.BOOTSTRAP_ADMIN_EMAIL = 'prod-owner@example.com';
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'DifferentNewPassword2026!';

    const res = bootstrapProductionAdmin();
    assert.equal(res.bootstrapped, false);
    assert.match(res.reason || '', /already exists/);

    const user = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('prod-owner@example.com') as Record<string, unknown>;
    // Original password must still be valid
    assert.equal(bcrypt.compareSync('SuperSecurePassword2026!', String(user.password_hash)), true);
    // New password should not have overwritten it
    assert.equal(bcrypt.compareSync('DifferentNewPassword2026!', String(user.password_hash)), false);
  });
});

describe('Production Owner API authentication and branch operations', () => {
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
        branchName: 'Gulshan Flagship',
        branchCode: 'GLS-01',
        phone: '+880 1700-112233',
        address: 'Road 103, Gulshan 2, Dhaka',
        currency: '৳',
        taxRate: 7.5,
        receiptFooter: 'Welcome to Musafir Prime!',
        publicMenuUrl: 'https://prime.musafir.local/menu'
      })
    });

    assert.equal(updateRes.status, 200);
    const body = (await updateRes.json()) as { settings: Record<string, unknown> };
    assert.equal(body.settings.restaurantName, 'Musafir Prime Dining');
    assert.equal(body.settings.branchName, 'Gulshan Flagship');
    assert.equal(body.settings.branchCode, 'GLS-01');
    assert.equal(body.settings.taxRate, 7.5);

    // Verify GET /api/settings
    const getRes = await fetch(`${API}/api/settings`);
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as { settings: Record<string, unknown> };
    assert.equal(getBody.settings.branchCode, 'GLS-01');
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
        displayName: 'Branch Manager Karim',
        email: 'karim.branch@example.com',
        role: 'manager',
        password: 'ManagerPassword123!'
      })
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as { user: { email: string; role: string } };
    assert.equal(body.user.email, 'karim.branch@example.com');
    assert.equal(body.user.role, 'manager');
  });

  test('non-owner cannot modify organization/branch settings', async () => {
    // Login as the manager we just created
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'karim.branch@example.com',
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
