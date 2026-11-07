import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TransferGuardError, describeTransfer, isSameDatabase, isSameServer, parseTransferOptions, redactUrl
} from '../../server/transfer/options.js';

const SOURCE = 'postgresql://render_user:secret@oregon-postgres.render.com:5432/musafir_legacy';
const TARGET = 'postgresql://neon_user:secret@ep-cool-1234.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require';
const base = { DATABASE_URL: SOURCE, NEON_DATABASE_URL: TARGET, LEGACY_TRANSFER_REPORT_DISABLED: 'true' };

const code = (error: unknown) => (error as InstanceType<typeof TransferGuardError>).code;

test('passwords never leak into logs or reports', () => {
  assert.equal(redactUrl(SOURCE), 'postgresql://render_user:***@oregon-postgres.render.com:5432/musafir_legacy');
  assert.ok(!redactUrl(TARGET).includes('neon_user:secret'));
  assert.ok(redactUrl(TARGET).includes('neondb'));
  assert.equal(redactUrl(undefined), '(not configured)');
  assert.equal(redactUrl('not a url'), '(unparseable connection string)');
});

test('the same database is detected regardless of cosmetics', () => {
  assert.equal(isSameDatabase(SOURCE, SOURCE), true);
  assert.equal(isSameDatabase(SOURCE, 'postgres://render_user:other@OREGON-POSTGRES.render.com/musafir_legacy'), true);
  assert.equal(isSameDatabase(SOURCE, TARGET), false);
  // Same server, different database: allowed to transfer, but still the same host.
  const sibling = 'postgresql://render_user:secret@oregon-postgres.render.com:5432/other_db';
  assert.equal(isSameDatabase(SOURCE, sibling), false);
  assert.equal(isSameServer(SOURCE, sibling), true);
});

test('the default is a read-only dry run', () => {
  const options = parseTransferOptions([], base);
  assert.equal(options.mode, 'dry-run');
  assert.equal(options.batchSize, 300);
  assert.equal(options.conflictPolicy, 'abort');
  assert.equal(options.repairDuplicates, false);
  assert.equal(options.addMissingColumns, false);
  assert.equal(options.applySchema, false);
});

test('a real migration needs both the flag and the environment switch', () => {
  assert.equal(parseTransferOptions(['--commit'], { ...base, LEGACY_TRANSFER_COMMIT: 'true' }).mode, 'commit');

  assert.throws(
    () => parseTransferOptions(['--commit'], base),
    (error: unknown) => code(error) === 'commit-not-confirmed'
  );
  // An exported environment variable on its own must never write to production.
  assert.equal(parseTransferOptions([], { ...base, LEGACY_TRANSFER_COMMIT: 'true' }).mode, 'dry-run');
  // ...and the commit path warns loudly.
  const lines = describeTransfer(parseTransferOptions(['--commit'], { ...base, LEGACY_TRANSFER_COMMIT: 'true' }));
  assert.ok(lines.some(line => line.includes('THIS WRITES TO NEON')));
});

test('a shared source and target database is refused', () => {
  assert.throws(
    () => parseTransferOptions([], { ...base, NEON_DATABASE_URL: SOURCE }),
    (error: unknown) => code(error) === 'source-target-collision'
  );
});

test('missing or empty configuration fails loudly instead of guessing', () => {
  assert.throws(() => parseTransferOptions([], {}), (error: unknown) => code(error) === 'not-configured');
  assert.throws(
    () => parseTransferOptions([], { ...base, NEON_DATABASE_URL: '' }),
    (error: unknown) => code(error) === 'missing-target'
  );
  assert.throws(
    () => parseTransferOptions([], { ...base, DATABASE_URL: '' }),
    (error: unknown) => code(error) === 'missing-source'
  );
});

test('switches are parsed defensively', () => {
  assert.equal(parseTransferOptions([], { ...base, LEGACY_TRANSFER_BATCH_SIZE: '500' }).batchSize, 500);
  for (const bad of ['0', '-5', '5000', '2.5', 'many']) {
    assert.throws(
      () => parseTransferOptions([], { ...base, LEGACY_TRANSFER_BATCH_SIZE: bad }),
      (error: unknown) => code(error) === 'invalid-batch-size',
      'batch size "' + bad + '" must be rejected'
    );
  }
  assert.equal(parseTransferOptions([], { ...base, LEGACY_TRANSFER_CONFLICT: 'REPLACE' }).conflictPolicy, 'replace');
  assert.throws(
    () => parseTransferOptions([], { ...base, LEGACY_TRANSFER_CONFLICT: 'overwrite' }),
    (error: unknown) => code(error) === 'invalid-conflict-policy'
  );
  assert.deepEqual(
    parseTransferOptions([], { ...base, LEGACY_TRANSFER_TABLES: ' Orders , payments ' }).tables,
    ['orders', 'payments']
  );
  assert.equal(
    parseTransferOptions(['--apply-schema'], base).applySchema,
    true,
    '--apply-schema is opt-in'
  );
});

test('the report path is timestamped and never written during a dry run with reporting off', () => {
  const reportable = parseTransferOptions([], { DATABASE_URL: SOURCE, NEON_DATABASE_URL: TARGET });
  assert.match(reportable.reportPath!, /^reports\/legacy-transfer-dry-run-.*\.json$/);
  assert.equal(parseTransferOptions([], base).reportPath, null);
  assert.equal(parseTransferOptions([], { ...base, LEGACY_TRANSFER_REPORT: 'out/report.json' }).reportPath, 'out/report.json');
});
