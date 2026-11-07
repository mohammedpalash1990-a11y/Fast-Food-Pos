import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffColumns, disambiguateValue, findDuplicateGroups, hasBlockingDrift, isRowCountConsistent,
  isSafeCast, pickRewritableColumn, summarizeCounts, textLength, typeFamily,
  type ColumnInfo
} from '../../server/transfer/reconcile.js';

const column = (name: string, formatType: string, extra: Partial<ColumnInfo> = {}): ColumnInfo => ({
  name,
  formatType,
  dataType: formatType,
  family: typeFamily(formatType.replace(/\(.*$/, '')),
  nullable: true,
  hasDefault: false,
  identity: false,
  generated: false,
  ordinal: 1,
  ...extra
});

test('PostgreSQL types are grouped into comparable families', () => {
  assert.equal(typeFamily('uuid'), 'uuid');
  assert.equal(typeFamily('character varying'), 'text');
  assert.equal(typeFamily('numeric'), 'decimal');
  assert.equal(typeFamily('timestamp with time zone'), 'timestamp');
  assert.equal(typeFamily('jsonb'), 'json');
  assert.equal(typeFamily('ARRAY'), 'array');
});

test('compatible casts are allowed, incompatible types block the transfer', () => {
  assert.equal(isSafeCast(column('a', 'numeric(12,2)'), column('a', 'numeric(10,2)')), true);
  assert.equal(isSafeCast(column('a', 'text'), column('a', 'uuid')), true, 'legacy text ids can go into uuid columns');
  assert.equal(isSafeCast(column('a', 'integer'), column('a', 'numeric(12,2)')), true);
  assert.equal(isSafeCast(column('a', 'boolean'), column('a', 'uuid')), false);
  assert.equal(isSafeCast(column('a', 'uuid'), column('a', 'integer')), false);
});

test('column drift separates blocking problems from safe conversions', () => {
  const drift = diffColumns(
    [column('id', 'uuid'), column('total', 'numeric(12,2)'), column('legacy_note', 'text'), column('payload', 'text')],
    [column('id', 'uuid'), column('total', 'numeric(14,4)'), column('payload', 'integer'), column('new_column', 'text')]
  );
  assert.deepEqual(drift.missingInTarget, ['legacy_note']);
  assert.deepEqual(drift.missingInSource, ['new_column']);
  assert.deepEqual(drift.typeConflicts, [{ column: 'payload', source: 'text', target: 'integer' }]);
  assert.deepEqual(drift.typeCasts, [{ column: 'total', source: 'numeric(12,2)', target: 'numeric(14,4)' }]);
  assert.equal(hasBlockingDrift(drift), true);

  const onlyCasts = diffColumns([column('total', 'numeric(12,2)')], [column('total', 'numeric(14,4)')]);
  assert.equal(hasBlockingDrift(onlyCasts), false, 'a numeric widening is not blocking');
});

test('duplicate repair keeps every row with a stable, bounded suffix', () => {
  const taken = new Set(['INV-9', 'INV-9~dup2', 'INV-9~dup3']);
  assert.equal(disambiguateValue('INV-9', taken), 'INV-9~dup4');
  // Respects the column length limit and never repeats a value.
  const long = 'X'.repeat(200);
  const suffixed = disambiguateValue(long, new Set([long]), 40);
  assert.ok(suffixed.length <= 40, 'the suffix never overflows the column limit');
  assert.ok(suffixed.endsWith('~dup2'));
});

test('only a text column inside the unique key can absorb a suffix', () => {
  const key = { name: 'purchases_org_invoice_key', columns: ['organization_id', 'invoice_number'] };
  const columns = [column('organization_id', 'uuid'), column('invoice_number', 'text')];
  assert.equal(pickRewritableColumn(key, columns, ['id']), 'invoice_number');

  const allUuid = { name: 'key', columns: ['organization_id', 'branch_id'] };
  assert.equal(pickRewritableColumn(allUuid, [column('organization_id', 'uuid'), column('branch_id', 'uuid')], ['id']), null);
  // Primary-key columns are never rewritten.
  const primary = { name: 'key', columns: ['code'] };
  assert.equal(pickRewritableColumn(primary, [column('code', 'text')], ['code']), null);
});

test('text length limits are read from the column type', () => {
  assert.equal(textLength(column('code', 'character varying(64)')), 64);
  assert.equal(textLength(column('code', 'text')), 120);
  assert.equal(textLength(undefined), 120);
});

test('duplicate groups keep the first row and never treat NULLs as duplicates', () => {
  const key = { name: 'key', columns: ['invoice'] };
  const rows = [{ id: '1', invoice: 'A' }, { id: '2', invoice: 'A' }, { id: '3', invoice: null }, { id: '4', invoice: null }];
  const { winners, losers } = findDuplicateGroups(rows, key, row => String(row.id));
  assert.deepEqual(winners.map(row => row.id), ['1', '3', '4']);
  assert.deepEqual(losers.map(entry => entry.row.id), ['2']);
  assert.equal(losers[0]!.winner.id, '1');
});

test('row counts must reconcile exactly before a migration is accepted', () => {
  assert.equal(isRowCountConsistent({ table: 'orders', source: 10, target: 10, transferred: 10 }), true);
  assert.equal(isRowCountConsistent({ table: 'orders', source: 10, target: 12, transferred: 10 }), true, 'extra Neon-only rows are allowed');
  assert.equal(isRowCountConsistent({ table: 'orders', source: 10, target: 9, transferred: 9 }), false, 'one lost row fails');
  assert.equal(isRowCountConsistent({ table: 'orders', source: 10, target: 10, transferred: 8 }), false);

  assert.deepEqual(
    summarizeCounts([
      { table: 'a', source: 2, target: 2, transferred: 2 },
      { table: 'b', source: 3, target: 4, transferred: 3 }
    ]),
    { sourceTotal: 5, targetTotal: 6, tables: 2 }
  );
});
