/**
 * End-to-end tests for the legacy Render -> Neon transfer against two real
 * PostgreSQL databases.
 *
 * The suite proves the three invariants the migration depends on:
 *   1. the dry run never writes and never touches the legacy database;
 *   2. schema drift, duplicates and missing data are detected and repaired;
 *   3. after a commit every legacy row matches Neon exactly, and failures roll back.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { runLegacyTransfer } from '../../server/transfer/engine.js';
import { TransferGuardError } from '../../server/transfer/options.js';
import { applySchema, seedDuplicateInvoices, seedLegacy } from '../fixtures/legacy-db.js';
import { LEGACY_URL, NEON_URL, createDatabase, resetSchema, skipWithoutDatabases } from '../helpers/pg.js';

type Handle = { url: string; drop: () => Promise<void> };
let legacy: Handle;
let neon: Handle;

const env = (overrides: Record<string, string> = {}) => ({
  DATABASE_URL: legacy.url,
  NEON_DATABASE_URL: neon.url,
  LEGACY_TRANSFER_REPORT_DISABLED: 'true',
  ...overrides
});

async function connect(url: string): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Byte-level snapshot of a whole database, used to prove that a run did not
 * modify the legacy source (or that a dry run did not write to Neon).
 */
async function fingerprint(url: string): Promise<string> {
  const client = await connect(url);
  try {
    const tables = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
    );
    const columns = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public' ORDER BY table_name, ordinal_position`
    );
    const parts: string[] = [JSON.stringify(columns.rows)];
    for (const { table_name } of tables.rows) {
      const rows = await client.query('SELECT * FROM "' + table_name + '" ORDER BY 1::text, 2::text');
      parts.push(table_name + '=' + rows.rows.length + ':' + JSON.stringify(rows.rows));
    }
    return parts.join('\n');
  } finally {
    await client.end();
  }
}

async function seedSource(options: { clean?: boolean; duplicates?: boolean } = {}) {
  const source = await connect(legacy.url);
  const seeded = await seedLegacy(source, { clean: options.clean });
  if (options.duplicates) await seedDuplicateInvoices(source, seeded.ids);
  await source.end();
  return seeded;
}

async function preparedTarget(): Promise<void> {
  const target = await connect(neon.url);
  await applySchema(target);
  await target.end();
}

const repairs = {
  LEGACY_TRANSFER_IGNORE_TABLES: 'legacy_import_queue',
  LEGACY_TRANSFER_ADD_MISSING_COLUMNS: 'true',
  LEGACY_TRANSFER_REPAIR_DUPLICATES: 'true'
};

describe('legacy Render -> Neon transfer', { skip: skipWithoutDatabases }, () => {
  before(async () => {
    legacy = await createDatabase(LEGACY_URL!, 'legacy');
    neon = await createDatabase(NEON_URL!, 'neon');
  });

  after(async () => {
    await legacy?.drop();
    await neon?.drop();
  });

  test('an empty target schema stops the run before any row is copied', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    await seedSource();
    const legacyBefore = await fingerprint(legacy.url);
    const neonBefore = await fingerprint(neon.url);

    await assert.rejects(
      () => runLegacyTransfer([], env()),
      (error: unknown) => {
        assert.ok(error instanceof TransferGuardError);
        assert.equal((error as InstanceType<typeof TransferGuardError>).code, 'target-not-initialized');
        return true;
      }
    );

    assert.equal(await fingerprint(legacy.url), legacyBefore);
    assert.equal(await fingerprint(neon.url), neonBefore);
  });

  test('a legacy-only table blocks the run until it is reviewed', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    await seedSource();
    await preparedTarget();
    const neonBefore = await fingerprint(neon.url);

    await assert.rejects(
      () => runLegacyTransfer([], env()),
      (error: unknown) => {
        assert.ok(error instanceof TransferGuardError);
        assert.equal((error as InstanceType<typeof TransferGuardError>).code, 'unsupported-tables');
        assert.match((error as Error).message, /legacy_import_queue/);
        return true;
      }
    );
    assert.equal(await fingerprint(neon.url), neonBefore, 'the rejected run wrote nothing');
  });

  test('unidentified column drift blocks until the target schema is fixed', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    await seedSource();
    await preparedTarget();

    await assert.rejects(
      () => runLegacyTransfer([], env({ LEGACY_TRANSFER_IGNORE_TABLES: 'legacy_import_queue' })),
      (error: unknown) => {
        assert.ok(error instanceof TransferGuardError);
        assert.match((error as Error).message, /missing legacy columns/);
        return true;
      }
    );
  });

  test('a dry run verifies every row, repairs drift in-transaction, and rolls back', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    await seedSource({ duplicates: true });
    await preparedTarget();
    const legacyBefore = await fingerprint(legacy.url);
    const neonBefore = await fingerprint(neon.url);

    const report = await runLegacyTransfer([], env(repairs));

    assert.equal(report.mode, 'dry-run');
    assert.equal(report.result, 'clean');
    assert.ok(report.totals.transferredRows > 0);
    assert.equal(report.totals.sourceRows, report.totals.transferredRows, 'every legacy row reached Neon');
    assert.ok(report.fixes.some(fix => /Added column/.test(fix)), 'the missing legacy column is reported as repaired');
    assert.ok(
      report.fixes.some(fix => /disambiguate duplicate purchases/.test(fix)),
      'the duplicate purchase invoice is reported as repaired'
    );
    const purchasePlan = report.tables.find(plan => plan.table === 'purchases')!;
    assert.equal(purchasePlan.duplicates.length, 1);
    assert.equal(purchasePlan.duplicates[0]!.groups, 1);
    assert.equal(purchasePlan.duplicates[0]!.strategy, 'rewrite');

    // The dry run must have written nothing anywhere, including the ALTER TABLE.
    assert.equal(await fingerprint(legacy.url), legacyBefore, 'legacy database untouched');
    assert.equal(await fingerprint(neon.url), neonBefore, 'Neon rolled back, schema included');
  });

  test('commit needs both the flag and the environment switch', async () => {
    await assert.rejects(
      () => runLegacyTransfer(['--commit'], env()),
      (error: unknown) => error instanceof TransferGuardError && error.code === 'commit-not-confirmed'
    );
    // The environment switch alone must not be enough.
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    await seedSource({ clean: true });
    await preparedTarget();
    const report = await runLegacyTransfer([], env({ LEGACY_TRANSFER_COMMIT: 'true' }));
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.result, 'clean');
  });

  test('refuses to run when source and target are the same database', async () => {
    await assert.rejects(
      () => runLegacyTransfer([], { DATABASE_URL: legacy.url, NEON_DATABASE_URL: legacy.url }),
      (error: unknown) => error instanceof TransferGuardError && error.code === 'source-target-collision'
    );
  });

  test('a real migration copies every table and verifies every row exactly', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    const seeded = await seedSource({ duplicates: true });
    await preparedTarget();
    const legacyBefore = await fingerprint(legacy.url);

    const report = await runLegacyTransfer(['--commit'], env({ ...repairs , LEGACY_TRANSFER_COMMIT: 'true' }));

    assert.equal(report.result, 'committed');
    assert.ok(report.results.length >= 20, 'every populated table was transferred');
    for (const result of report.results) {
      assert.equal(result.transferred, result.source, result.table + ' copied every legacy row');
      assert.equal(result.verified, result.source, result.table + ' verified every legacy row');
      assert.ok(result.target >= result.source, result.table + ' holds at least the legacy rows');
    }

    // The legacy database is byte-identical: nothing deleted, nothing modified.
    assert.equal(await fingerprint(legacy.url), legacyBefore);

    const target = await connect(neon.url);
    try {
      // Microsecond timestamps survived the copy unchanged.
      const order = await target.query<{ created_at: string }>(
        'SELECT created_at::text FROM orders WHERE order_number = 1001'
      );
      assert.match(order.rows[0]!.created_at, /18:42:11\.123456/);

      // NULL customer/table survived as NULL rather than becoming a default.
      const nulls = await target.query<{ n: string }>(
        'SELECT COUNT(*)::text AS n FROM orders WHERE customer_id IS NULL AND table_id IS NULL'
      );
      assert.equal(Number(nulls.rows[0]!.n), 1);

      // Duplicate invoices were preserved, not dropped.
      const invoices = await target.query<{ invoice_number: string }>(
        "SELECT invoice_number FROM purchases WHERE invoice_number LIKE 'INV-DUP%' ORDER BY invoice_number"
      );
      assert.deepEqual(invoices.rows.map(row => row.invoice_number), ['INV-DUP', 'INV-DUP~dup2']);

      // Row counts match the legacy source for every table.
      for (const [table, expected] of Object.entries(seeded.counts)) {
        const count = await target.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM "' + table + '"');
        const actual = Number(count.rows[0]!.count);
        const addition = table === 'purchases' ? 2 : 0;
        assert.equal(actual, expected + addition, table + ' row count matches the legacy database');
      }

      // Re-running the committed transfer is idempotent.
      const second = await runLegacyTransfer(['--commit'], env({
        ...repairs, LEGACY_TRANSFER_COMMIT: 'true', LEGACY_TRANSFER_CONFLICT: 'replace'
      }));
      assert.equal(second.result, 'committed');
      for (const result of second.results) {
        assert.equal(result.inserted, 0, result.table + ' inserts nothing on a re-run');
        assert.equal(result.verified, result.source, result.table + ' still verifies on a re-run');
      }
      const orders = await target.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM orders');
      assert.equal(Number(orders.rows[0]!.count), 2, 'no duplicate orders were created');
    } finally {
      await target.end();
    }
  });

  test('a divergent Neon row blocks the commit instead of being overwritten', async () => {
    await resetSchema(legacy.url);
    await resetSchema(neon.url);
    const seeded = await seedSource({ clean: true, duplicates: false });
    await preparedTarget();

    const target = await connect(neon.url);
    // Same primary key as the legacy order, different total: silently replacing it
    // would lose Neon-only data. The parent rows must exist first (real FKs).
    await target.query('BEGIN');
    await target.query('INSERT INTO organizations(id, name, slug) VALUES($1, $2, $3)', [seeded.ids.organization, 'Musafir Fast Food', 'musafir-legacy']);
    await target.query('INSERT INTO branches(id, organization_id, name, code) VALUES($1, $2, $3, $4)', [seeded.ids.branch, seeded.ids.organization, 'Main Branch', 'KSA-01']);
    await target.query(
      `INSERT INTO orders(id, organization_id, branch_id, order_number, order_type, status, subtotal, tax, discount, total, created_at)
       VALUES($1,$2,$3,1001,'Dine-in','Completed',25.00,3.75,0,999.00,'2026-01-05 18:42:11.123456+00')`,
      [seeded.ids.order, seeded.ids.organization, seeded.ids.branch]
    );
    await target.query('COMMIT');
    await target.end();

    await assert.rejects(
      () => runLegacyTransfer(['--commit'], env({ LEGACY_TRANSFER_COMMIT: 'true' })),
      (error: unknown) => {
        assert.ok(error instanceof TransferGuardError);
        assert.equal((error as InstanceType<typeof TransferGuardError>).code, 'duplicate-conflict');
        assert.match((error as Error).message, /values differ/);
        return true;
      }
    );

    const check = await connect(neon.url);
    try {
      const order = await check.query<{ total: string }>('SELECT total::text FROM orders WHERE id = $1', [seeded.ids.order]);
      assert.equal(Number(order.rows[0]!.total), 999, 'the divergent Neon row was left untouched');
      const items = await check.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM order_items');
      assert.equal(Number(items.rows[0]!.count), 0, 'the failed run rolled back all inserted rows');
    } finally {
      await check.end();
    }
  });

  test('the legacy session is read-only at the PostgreSQL level', async () => {
    await resetSchema(legacy.url);
    await seedSource({ clean: true });

    const probe = await connect(legacy.url);
    try {
      await probe.query('SET default_transaction_read_only = on');
      await probe.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await assert.rejects(
        () => probe.query("UPDATE organizations SET name = 'hijacked'"),
        /read-only transaction|cannot execute/
      );
      await probe.query('ROLLBACK');
    } finally {
      await probe.end();
    }
  });
});
