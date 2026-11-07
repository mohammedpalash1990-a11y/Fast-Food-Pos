/**
 * Legacy Render PostgreSQL -> Neon PostgreSQL transfer engine.
 *
 * Guarantees
 *  1. The legacy source session is opened READ ONLY (default_transaction_read_only)
 *     inside a REPEATABLE READ transaction. It is never modified or deleted.
 *  2. Nothing is written to Neon unless BOTH `--commit` and
 *     LEGACY_TRANSFER_COMMIT=true are supplied; the default is a dry run that is
 *     rolled back.
 *  3. Every problem (schema mismatch, missing data, duplicate conflict) is
 *     detected and either repaired deterministically or reported as a blocker
 *     before any row is committed.
 *  4. After the copy, every source row is compared column-by-column against Neon.
 *     A single mismatch aborts the run and nothing is committed.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Client, types } from 'pg';
import {
  TransferGuardError, describeTransfer, parseTransferOptions, redactUrl,
  type TransferOptions
} from './options.js';
import {
  MIGRATION_METADATA_TABLES, PREFERRED_TABLE_ORDER, orderTablesByForeignKeys,
  type ForeignKeyEdge
} from './ordering.js';
import {
  diffColumns, disambiguateValue, isRowCountConsistent, pickRewritableColumn, summarizeCounts,
  textLength, typeFamily, type ColumnDrift, type ColumnInfo, type TableRowCount, type UniqueKey
} from './reconcile.js';

type Row = Record<string, unknown>;

type TableCatalog = {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  uniqueKeys: UniqueKey[];
};

type DuplicatePlan = {
  key: UniqueKey;
  groups: number;
  rows: number;
  strategy: 'rewrite' | 'blocked';
  column: string | null;
  maxLength: number;
};

type TablePlan = {
  table: string;
  sourceRows: number;
  targetRows: number;
  drift: ColumnDrift;
  targetOnlyNotNull: string[];
  duplicates: DuplicatePlan[];
  action: 'transfer' | 'skipped' | 'blocked';
  notes: string[];
  blockers: string[];
};

type TableResult = TableRowCount & {
  inserted: number;
  updated: number;
  repairedDuplicates: number;
  verified: number;
};

export type TransferReport = {
  generatedAt: string;
  mode: 'dry-run' | 'commit';
  result: 'clean' | 'planned' | 'committed' | 'blocked' | 'failed';
  source: string;
  target: string;
  batchSize: number;
  conflictPolicy: string;
  schemaApplied: string[];
  tables: TablePlan[];
  results: TableResult[];
  totals: { sourceRows: number; transferredRows: number; tables: number };
  blockers: string[];
  fixes: string[];
  warnings: string[];
};

const MIGRATION_ORDER = [
  '001_initial.sql', '002_team_payroll.sql', '003_reservations.sql', '004_restaurant_tables.sql',
  '005_delivery_dispatch.sql', '006_order_table_assignment.sql', '007_order_idempotency.sql',
  '008_payroll_hardening.sql'
];

/** Keep timestamps as raw strings so PostgreSQL microseconds survive the copy. */
const RAW_TYPE_PARSERS = {
  getTypeParser: (oid: number, format?: unknown) => {
    if (oid === 1114 || oid === 1184) return (value: string) => value;
    return types.getTypeParser(oid, format as 'text');
  }
};

function makeClient(url: string): Client {
  const client = new Client({
    connectionString: url,
    application_name: 'musafir-legacy-transfer',
    types: RAW_TYPE_PARSERS as never,
    ssl: url.includes('neon.tech') ? { rejectUnauthorized: true } : process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined
  });
  return client;
}

const quote = (identifier: string) => '"' + identifier.replace(/"/g, '""') + '"';
const qualified = (schema: string, table: string) => quote(schema) + '.' + quote(table);

// ---------------------------------------------------------------------------
// Catalog inspection
// ---------------------------------------------------------------------------

async function listBaseTables(client: Client, schema = 'public'): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [schema]
  );
  return result.rows.map(row => row.table_name);
}

async function loadColumns(client: Client, table: string, schema = 'public'): Promise<ColumnInfo[]> {
  const result = await client.query<{
    column_name: string; data_type: string; udt_name: string; character_maximum_length: number | null;
    numeric_precision: number | null; numeric_scale: number | null; is_nullable: string;
    column_default: string | null; is_identity: string; is_generated: string; ordinal_position: number;
  }>(
    `SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale,
            is_nullable, column_default, is_identity, is_generated, ordinal_position
     FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [schema, table]
  );
  return result.rows.map(row => ({
    name: row.column_name,
    formatType: formatType(row),
    dataType: row.data_type,
    family: familyOf(row),
    nullable: row.is_nullable === 'YES',
    hasDefault: row.column_default !== null,
    identity: row.is_identity === 'YES',
    generated: row.is_generated === 'ALWAYS',
    ordinal: row.ordinal_position
  }));
}

function familyOf(row: { data_type: string }) {
  const dataType = row.data_type === 'ARRAY' ? 'array' : row.data_type;
  return typeFamily(dataType);
}

/** Rebuild the exact type for casting, e.g. numeric(12,2), varchar(40). */
function formatType(row: {
  data_type: string; udt_name: string; character_maximum_length: number | null;
  numeric_precision: number | null; numeric_scale: number | null;
}): string {
  if (row.data_type === 'ARRAY') return row.udt_name.replace(/^_/, '') + '[]';
  if (row.data_type === 'USER-DEFINED') return row.udt_name;
  if (row.data_type === 'character varying' && row.character_maximum_length) return 'character varying(' + row.character_maximum_length + ')';
  if (row.data_type === 'character' && row.character_maximum_length) return 'character(' + row.character_maximum_length + ')';
  if (row.data_type === 'numeric' && row.numeric_precision !== null) {
    return row.numeric_scale === null ? 'numeric(' + row.numeric_precision + ')' : 'numeric(' + row.numeric_precision + ',' + row.numeric_scale + ')';
  }
  return row.data_type;
}

async function loadPrimaryKey(client: Client, table: string, schema = 'public'): Promise<string[]> {
  const result = await client.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [schema, table]
  );
  return result.rows.map(row => row.column_name);
}

async function loadUniqueKeys(client: Client, table: string, schema = 'public'): Promise<UniqueKey[]> {
  const result = await client.query<{ constraint_name: string; column_name: string; ordinal: number }>(
    `SELECT tc.constraint_name, kcu.column_name, kcu.ordinal_position AS ordinal
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'UNIQUE'
     ORDER BY tc.constraint_name, kcu.ordinal_position`,
    [schema, table]
  );
  const keys = new Map<string, string[]>();
  for (const row of result.rows) {
    const list = keys.get(row.constraint_name) || [];
    list.push(row.column_name);
    keys.set(row.constraint_name, list);
  }
  return [...keys.entries()].map(([name, columns]) => ({ name, columns }));
}

async function loadForeignKeys(client: Client, schema = 'public'): Promise<ForeignKeyEdge[]> {
  const result = await client.query<{ table: string; references: string }>(
    `SELECT t.relname AS table, rt.relname AS "references"
     FROM pg_constraint co
     JOIN pg_class t ON t.oid = co.conrelid
     JOIN pg_class rt ON rt.oid = co.confrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE co.contype = 'f' AND n.nspname = $1 AND t.relname <> rt.relname`,
    [schema]
  );
  return result.rows;
}

async function loadCatalog(client: Client, tables: string[], schema = 'public'): Promise<Map<string, TableCatalog>> {
  const catalog = new Map<string, TableCatalog>();
  for (const table of tables) {
    const [columns, primaryKey, uniqueKeys] = await Promise.all([
      loadColumns(client, table, schema),
      loadPrimaryKey(client, table, schema),
      loadUniqueKeys(client, table, schema)
    ]);
    catalog.set(table, { name: table, columns, primaryKey, uniqueKeys });
  }
  return catalog;
}

async function countRows(client: Client, table: string, schema = 'public'): Promise<number> {
  const result = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM ' + qualified(schema, table));
  return Number(result.rows[0].count);
}

// ---------------------------------------------------------------------------
// Schema reconciliation
// ---------------------------------------------------------------------------

async function applyMigrations(client: Client, options: { files?: string[]; label?: string } = {}): Promise<string[]> {
  const applied: string[] = [];
  const files = options.files || MIGRATION_ORDER;
  for (const file of files) {
    const sql = await readFile(new URL('../../db/migrations/' + file, import.meta.url), 'utf8');
    await client.query(sql);
    applied.push(file);
  }
  return applied;
}

async function createMissingColumns(client: Client, table: string, drift: ColumnDrift, source: Map<string, TableCatalog>, schema = 'public'): Promise<string[]> {
  const added: string[] = [];
  const sourceColumns = new Map((source.get(table)?.columns || []).map(column => [column.name, column]));
  for (const name of drift.missingInTarget) {
    const column = sourceColumns.get(name);
    if (!column) continue;
    if (!column.nullable && !column.hasDefault) continue; // cannot be added safely
    await client.query(
      'ALTER TABLE ' + qualified(schema, table) + ' ADD COLUMN IF NOT EXISTS ' + quote(name) + ' ' + column.formatType +
      (column.hasDefault ? '' : '')
    );
    added.push(table + '.' + name + ' ' + column.formatType);
  }
  return added;
}

// ---------------------------------------------------------------------------
// Duplicate detection / repair
// ---------------------------------------------------------------------------

async function detectDuplicates(
  source: Client,
  table: string,
  keys: UniqueKey[],
  columns: ColumnInfo[],
  primaryKey: string[]
): Promise<{ key: UniqueKey; groups: number; rows: number; column: string | null; maxLength: number }[]> {
  const found: { key: UniqueKey; groups: number; rows: number; column: string | null; maxLength: number }[] = [];
  for (const key of keys) {
    const result = await source.query<{ groups: string; rows: string }>(
      'SELECT COUNT(*)::text AS groups, COALESCE(SUM(n), 0)::text AS rows FROM (' +
        'SELECT COUNT(*) AS n FROM ' + qualified('public', table) +
        ' WHERE ' + key.columns.map(column => quote(column) + ' IS NOT NULL').join(' AND ') +
        ' GROUP BY ' + key.columns.map(quote).join(',') + ' HAVING COUNT(*) > 1' +
      ') dup'
    );
    const groups = Number(result.rows[0].groups);
    if (!groups) continue;
    const column = pickRewritableColumn(key, columns, primaryKey);
    found.push({
      key,
      groups,
      rows: Number(result.rows[0].rows),
      column,
      maxLength: textLength(columns.find(entry => entry.name === column))
    });
  }
  return found;
}

/**
 * Rewrite duplicate values on a text unique column so every legacy row survives.
 *
 * Deterministic: rows arrive in primary-key order, so the first row of a group
 * keeps its original value and later rows get a stable "~dupN" suffix. Used values
 * are tracked per group (not per row), so three or more collisions as well as
 * collisions spread across batches are all resolved without ever reusing a value.
 */
function repairDuplicatesInBatch(
  rows: Row[],
  plans: { key: UniqueKey; column: string; maxLength: number }[],
  used: Map<string, Map<string, Set<string>>>,
  counters: { repaired: number }
): Row[] {
  if (!plans.length) return rows;
  for (const row of rows) {
    for (const plan of plans) {
      const value = row[plan.column];
      if (typeof value !== 'string') continue;

      // The rewritten column is excluded so a suffix can actually break the tie.
      const groupSignature = JSON.stringify(
        plan.key.columns.filter(column => column !== plan.column).map(column => row[column] ?? null)
      );
      const storeKey = plan.key.name + '|' + plan.key.columns.join(',') + '|' + plan.column;
      let groups = used.get(storeKey);
      if (!groups) { groups = new Map(); used.set(storeKey, groups); }
      let taken = groups.get(groupSignature);
      if (!taken) { taken = new Set(); groups.set(groupSignature, taken); }

      if (!taken.has(value)) { taken.add(value); continue; }

      const next = disambiguateValue(value, taken, plan.maxLength);
      row[plan.column] = next;
      taken.add(next);
      counters.repaired += 1;
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Transfer
// ---------------------------------------------------------------------------

type BatchOutcome = { inserted: number; updated: number; verified: number };

async function transferBatch(
  target: Client,
  table: string,
  columns: ColumnInfo[],
  primaryKey: string[],
  rows: Row[],
  policy: 'abort' | 'skip' | 'replace'
): Promise<BatchOutcome> {
  if (!rows.length) return { inserted: 0, updated: 0, verified: 0 };

  const insertColumns = columns.filter(column => !column.generated);
  const values: unknown[] = [];
  const tuples = rows.map(row => {
    const marks = insertColumns.map(column => {
      const value = row[column.name];
      values.push(value === undefined ? null : value);
      return '$' + values.length + '::' + column.formatType;
    });
    return '(' + marks.join(',') + ')';
  });

  const identityColumns = insertColumns.filter(column => column.identity);
  const override = identityColumns.length ? ' OVERRIDING SYSTEM VALUE' : '';
  const conflictTarget = '(' + primaryKey.map(quote).join(',') + ')';
  const updatable = insertColumns.filter(column => !primaryKey.includes(column.name));
  const conflictAction = policy === 'replace' && updatable.length
    ? 'DO UPDATE SET ' + updatable.map(column => quote(column.name) + ' = EXCLUDED.' + quote(column.name)).join(', ')
    : 'DO NOTHING';

  const insertSql =
    'INSERT INTO ' + qualified('public', table) + ' (' + insertColumns.map(column => quote(column.name)).join(',') + ')' +
    override + ' VALUES ' + tuples.join(',') +
    ' ON CONFLICT ' + conflictTarget + ' ' + conflictAction +
    ' RETURNING (xmax = 0) AS inserted';

  const insertedResult = await target.query<{ inserted: boolean }>(insertSql, values);
  const inserted = insertedResult.rows.filter(row => row.inserted).length;
  const updated = insertedResult.rowCount! - inserted;

  const verified = await countExactMatches(target, table, columns, primaryKey, rows);
  return { inserted, updated, verified };
}

/**
 * Exact verification: every incoming source row is compared to the persisted Neon
 * row across every column, with IS NOT DISTINCT FROM so NULLs must match too.
 */
async function countExactMatches(
  target: Client,
  table: string,
  columns: ColumnInfo[],
  primaryKey: string[],
  rows: Row[]
): Promise<number> {
  if (!rows.length) return 0;
  const values: unknown[] = [];
  const tuples = rows.map(row => {
    const marks = columns.map(column => {
      values.push(row[column.name] === undefined ? null : row[column.name]);
      return '$' + values.length + '::' + column.formatType;
    });
    return '(' + marks.join(',') + ')';
  });

  const keyJoin = primaryKey.map(column => 'p.' + quote(column) + ' = i.' + quote(column)).join(' AND ');
  const valueMatch = columns.map(column =>
    'p.' + quote(column.name) + ' IS NOT DISTINCT FROM i.' + quote(column.name)
  ).join(' AND ');

  const result = await target.query<{ matched: string }>(
    'SELECT COUNT(*)::text AS matched FROM (VALUES ' + tuples.join(',') + ') AS i(' +
      columns.map(column => quote(column.name)).join(',') + ') JOIN ' +
      qualified('public', table) + ' AS p ON ' + keyJoin + ' WHERE ' + valueMatch,
    values
  );
  return Number(result.rows[0].matched);
}

/** Count how many of the incoming primary keys already exist in the target. */
async function countExisting(
  target: Client,
  table: string,
  primaryKey: string[],
  columns: ColumnInfo[],
  rows: Row[]
): Promise<number> {
  if (!rows.length) return 0;
  const typeOf = new Map(columns.map(column => [column.name, column.formatType]));
  const values: unknown[] = [];
  const tuples = rows.map(row => {
    const marks = primaryKey.map(column => {
      values.push(row[column]);
      return '$' + values.length + '::' + (typeOf.get(column) || 'text');
    });
    return '(' + marks.join(',') + ')';
  });
  const result = await target.query<{ existing: string }>(
    'SELECT COUNT(*)::text AS existing FROM ' + qualified('public', table) +
      ' AS t JOIN (VALUES ' + tuples.join(',') + ') AS i(' + primaryKey.map(quote).join(',') + ') ON ' +
      primaryKey.map(column => 't.' + quote(column) + ' = i.' + quote(column)).join(' AND '),
    values
  );
  return Number(result.rows[0].existing);
}

async function streamTable(
  source: Client,
  table: string,
  columns: ColumnInfo[],
  primaryKey: string[],
  batchSize: number,
  onBatch: (rows: Row[]) => Promise<void>
): Promise<number> {
  let cursor: unknown[] | null = null;
  let total = 0;
  const columnList = columns.map(column => quote(column.name)).join(',');
  while (true) {
    const params: unknown[] = [];
    let where = '';
    if (cursor) {
      params.push(...cursor);
      const tuple = primaryKey.map(() => '?').join(',');
      const placeholders = primaryKey.map((_, index) => '$' + (index + 1)).join(',');
      where = ' WHERE (' + primaryKey.map(quote).join(',') + ') > (' + placeholders + ')';
      void tuple;
    }
    params.push(batchSize);
    const result = await source.query(
      'SELECT ' + columnList + ' FROM ' + qualified('public', table) + where +
        ' ORDER BY ' + primaryKey.map(quote).join(',') + ' LIMIT $' + params.length,
      params
    );
    const rows = result.rows as Row[];
    if (!rows.length) break;
    await onBatch(rows);
    total += rows.length;
    cursor = primaryKey.map(column => rows[rows.length - 1][column]);
    if (rows.length < batchSize) break;
  }
  return total;
}

async function resetIdentitySequences(target: Client, tables: string[]): Promise<string[]> {
  const reset: string[] = [];
  for (const table of tables) {
    const columns = await target.query<{ column_name: string; column_default: string }>(
      `SELECT column_name, column_default FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_default LIKE 'nextval(%'`,
      [table]
    );
    for (const column of columns.rows) {
      await target.query(
        "SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(" + quote(column.column_name) + ") FROM " + qualified('public', table) + "), 1))",
        ['public.' + table, column.column_name]
      );
      reset.push(table + '.' + column.column_name);
    }
  }
  return reset;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runLegacyTransfer(argv: readonly string[], env: Record<string, string | undefined>): Promise<TransferReport> {
  const options: TransferOptions = parseTransferOptions(argv, env);
  const warnings: string[] = [];
  const fixes: string[] = [];
  const blockers: string[] = [];

  for (const line of describeTransfer(options)) console.log(line);

  const source = makeClient(options.sourceUrl);
  const target = makeClient(options.targetUrl);
  const report: TransferReport = {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    result: 'planned',
    source: redactUrl(options.sourceUrl),
    target: redactUrl(options.targetUrl),
    batchSize: options.batchSize,
    conflictPolicy: options.conflictPolicy,
    schemaApplied: [],
    tables: [],
    results: [],
    totals: { sourceRows: 0, transferredRows: 0, tables: 0 },
    blockers,
    fixes,
    warnings
  };

  let sourceTx = false;
  let targetTx = false;
  let stage = 'connection';

  try {
    await source.connect();
    await target.connect();

    // Hard guarantee: the legacy database must reject every write from this session.
    await source.query('SET default_transaction_read_only = on');
    await source.query("SET statement_timeout = '15min'");
    await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    sourceTx = true;
    await target.query('BEGIN');
    targetTx = true;
    stage = 'schema-reconciliation';

    console.log('Source transaction: REPEATABLE READ, READ ONLY.');
    stage = 'source-inventory';

    if (options.applySchema) {
      report.schemaApplied = (await applyMigrations(target)).map(file => file);
      console.log('Applied target schema migrations: ' + report.schemaApplied.join(', '));
      fixes.push('Applied ' + report.schemaApplied.length + ' target schema migration(s).');
    }

    // ---- table inventory -------------------------------------------------
    const sourceTables = await listBaseTables(source);
    const targetTableList = await listBaseTables(target);
    const targetTables = new Set(targetTableList);
    const expectedTables = PREFERRED_TABLE_ORDER.filter(table => sourceTables.includes(table as never));
    const presentExpected = expectedTables.filter(table => targetTables.has(table));
    if (sourceTables.length && !presentExpected.length) {
      blockers.push(
        'The Neon target has no application tables yet. Apply the schema first: ' +
        'npm run db:migrate (or re-run this command with --apply-schema).'
      );
      throw new TransferGuardError('target-not-initialized', blockers.join(' '));
    }
    if (expectedTables.length && presentExpected.length < expectedTables.length) {
      const absent = expectedTables.filter(table => !targetTables.has(table));
      warnings.push('Neon is missing ' + absent.length + ' application table(s): ' + absent.join(', ') + '.');
    }
    const ignore = new Set(options.ignoreTables);
    const metadata = new Set<string>(MIGRATION_METADATA_TABLES);
    const unsupported = sourceTables.filter(table =>
      !ignore.has(table) && !metadata.has(table) &&
      (!options.tables.length || options.tables.includes(table)) &&
      !targetTables.has(table) && !PREFERRED_TABLE_ORDER.includes(table as never)
    );
    if (unsupported.length && !options.allowUnsupportedTables) {
      blockers.push(
        'Legacy database contains tables the Neon schema does not cover: ' + unsupported.join(', ') +
        '. Review them, then either extend db/migrations, list them in LEGACY_TRANSFER_IGNORE_TABLES, or set LEGACY_TRANSFER_ALLOW_UNSUPPORTED_TABLES=true.'
      );
      throw new TransferGuardError('unsupported-tables', blockers.join(' '));
    }
    for (const table of unsupported) {
      warnings.push('Legacy table "' + table + '" is not part of the Neon schema and will be skipped.');
    }

    let candidates = sourceTables.filter(table =>
      !ignore.has(table) && !metadata.has(table) && !unsupported.includes(table) &&
      (!options.tables.length || options.tables.includes(table))
    );
    const missingOnSource = PREFERRED_TABLE_ORDER.filter(table => options.tables.includes(table) && !sourceTables.includes(table));
    for (const table of missingOnSource) warnings.push('Requested table "' + table + '" does not exist in the legacy database.');

    // ---- foreign-key aware order ----------------------------------------
    const targetForeignKeys = await loadForeignKeys(target);
    const { order, cycles } = orderTablesByForeignKeys(candidates, targetForeignKeys, PREFERRED_TABLE_ORDER);
    if (cycles.length) {
      blockers.push('Foreign-key cycle detected between tables: ' + cycles.flat().join(', ') + '.');
      throw new TransferGuardError('fk-cycle', blockers.join(' '));
    }
    candidates = order;
    console.log('Transfer order (foreign-key safe): ' + candidates.join(' -> '));

    // ---- per-table planning ---------------------------------------------
    const sourceCatalog = await loadCatalog(source, candidates);
    const targetCatalog = await loadCatalog(target, candidates.filter(table => targetTables.has(table)));

    stage = 'table-planning';
    const plans: TablePlan[] = [];

    for (const table of candidates) {
      const sourceTable = sourceCatalog.get(table);
      if (!sourceTable) continue;
      const plan: TablePlan = {
        table,
        sourceRows: 0,
        targetRows: 0,
        drift: { missingInTarget: [], missingInSource: [], typeConflicts: [], typeCasts: [] },
        targetOnlyNotNull: [],
        duplicates: [],
        action: 'transfer',
        notes: [],
        blockers: []
      };

      if (!targetTables.has(table)) {
        plan.action = 'blocked';
        plan.blockers.push('Target schema has no table "' + table + '"; apply db/migrations to Neon first.');
        plans.push(plan);
        continue;
      }

      const targetTable = targetCatalog.get(table)!;
      plan.sourceRows = await countRows(source, table);
      plan.targetRows = await countRows(target, table);

      if (!sourceTable.primaryKey.length) {
        plan.action = 'blocked';
        plan.blockers.push('Table "' + table + '" has no primary key in the legacy database; the transfer needs one to match rows.');
        plans.push(plan);
        continue;
      }
      if (sourceTable.primaryKey.join(',') !== targetTable.primaryKey.join(',')) {
        plan.action = 'blocked';
        plan.blockers.push(
          'Primary key mismatch for "' + table + '": legacy (' + sourceTable.primaryKey.join(',') +
          ') vs Neon (' + targetTable.primaryKey.join(',') + ').'
        );
        plans.push(plan);
        continue;
      }

      plan.drift = diffColumns(sourceTable.columns, targetTable.columns);
      if (plan.drift.missingInTarget.length) {
        if (options.addMissingColumns) {
          const created = await createMissingColumns(target, table, plan.drift, sourceCatalog);
          if (created.length) {
            plan.notes.push('Created missing Neon columns: ' + created.join(', '));
            fixes.push('Added column(s) ' + created.join(', ') + ' to Neon.');
            const refreshed = new Map(targetCatalog);
            refreshed.set(table, {
              name: table,
              columns: await loadColumns(target, table),
              primaryKey: targetTable.primaryKey,
              uniqueKeys: targetTable.uniqueKeys
            });
            targetCatalog.set(table, refreshed.get(table)!);
            plan.drift = diffColumns(sourceTable.columns, refreshed.get(table)!.columns);
          }
          if (plan.drift.missingInTarget.length) {
            plan.action = 'blocked';
            plan.blockers.push('Neon is missing non-nullable columns for "' + table + '": ' + plan.drift.missingInTarget.join(', ') + '.');
          }
        } else {
          plan.action = 'blocked';
          plan.blockers.push(
            'Neon table "' + table + '" is missing legacy columns: ' + plan.drift.missingInTarget.join(', ') +
            '. Add them with a migration or re-run with --apply-schema / LEGACY_TRANSFER_ADD_MISSING_COLUMNS=true.'
          );
        }
      }
      if (plan.drift.typeConflicts.length) {
        plan.action = 'blocked';
        plan.blockers.push(
          'Incompatible column types in "' + table + '": ' +
          plan.drift.typeConflicts.map(conflict => conflict.column + ' (' + conflict.source + ' -> ' + conflict.target + ')').join(', ')
        );
      }
      if (plan.drift.typeCasts.length) {
        plan.notes.push('Compatible casts: ' + plan.drift.typeCasts.map(cast => cast.column + ' ' + cast.source + ' -> ' + cast.target).join(', '));
      }

      const targetColumns = new Map(targetCatalog.get(table)!.columns.map(column => [column.name, column]));
      plan.targetOnlyNotNull = plan.drift.missingInSource.filter(name => {
        const column = targetColumns.get(name);
        return !!column && !column.nullable && !column.hasDefault && !column.generated && !column.identity;
      });
      // A NOT NULL column without a default cannot be filled from the legacy data.
      if (plan.targetOnlyNotNull.length && options.mode === 'commit') {
        plan.action = 'blocked';
        plan.blockers.push(
          'Neon column(s) ' + plan.targetOnlyNotNull.join(', ') + ' in "' + table +
          '" are NOT NULL without a default, so legacy rows cannot be inserted. Add a default or make them nullable.'
        );
      } else if (plan.targetOnlyNotNull.length) {
        plan.notes.push('Would block on NOT NULL columns without defaults: ' + plan.targetOnlyNotNull.join(', '));
      }
      // duplicate conflicts against Neon unique keys
      const uniqueKeys = targetCatalog.get(table)!.uniqueKeys;
      const detected = await detectDuplicates(source, table, uniqueKeys, sourceTable.columns, sourceTable.primaryKey);
      for (const duplicate of detected) {
        const strategy = options.repairDuplicates && duplicate.column ? 'rewrite' : 'blocked';
        plan.duplicates.push({ ...duplicate, strategy });
        if (strategy === 'blocked') {
          plan.blockers.push(
            'Duplicate values in legacy "' + table + '" violate Neon unique key (' + duplicate.key.columns.join(', ') + '): ' +
            duplicate.groups + ' group(s), ' + duplicate.rows + ' row(s). Re-run with LEGACY_TRANSFER_REPAIR_DUPLICATES=true to keep every row by suffixing ' +
            (duplicate.column || 'a text column') + '.'
          );
          plan.action = 'blocked';
        } else {
          plan.notes.push(
            'Repairing ' + duplicate.groups + ' duplicate group(s) on (' + duplicate.key.columns.join(', ') +
            ') by suffixing ' + duplicate.column + '.'
          );
          fixes.push('Will disambiguate duplicate ' + table + '.' + duplicate.column + ' values (' + duplicate.groups + ' group(s)).');
        }
      }

      if (plan.blockers.length) plan.action = 'blocked';
      if (plan.action === 'transfer' && plan.sourceRows === 0) plan.action = 'skipped';
      plans.push(plan);
    }

    report.tables = plans;
    for (const plan of plans) {
      for (const blocker of plan.blockers) blockers.push(plan.table + ': ' + blocker);
    }
    printPlan(plans);

    if (blockers.length) {
      report.result = 'blocked';
      throw new TransferGuardError(
        'blocked',
        'Transfer blocked by ' + blockers.length + ' problem(s); nothing was written to Neon:\n' +
        blockers.map(blocker => '  - ' + blocker).join('\n')
      );
    }

    // ---- transfer --------------------------------------------------------
    stage = 'row-transfer';
    const transferPlans = plans.filter(plan => plan.action === 'transfer');
    for (const plan of transferPlans) {
      const table = plan.table;
      const sourceTable = sourceCatalog.get(table)!;
      const targetTable = targetCatalog.get(table)!;
      // Only columns that exist on both sides travel; target-only columns keep defaults.
      const targetNames = new Set(targetTable.columns.map(column => column.name));
      const columns = sourceTable.columns.filter(column => targetNames.has(column.name));
      const rewritePlans = plan.duplicates
        .filter(duplicate => duplicate.strategy === 'rewrite' && duplicate.column)
        .map(duplicate => ({ key: duplicate.key, column: duplicate.column!, maxLength: duplicate.maxLength }));
      const seen = new Map<string, Map<string, Set<string>>>();
      const counters = { repaired: 0 };
      const result: TableResult = {
        table, source: plan.sourceRows, target: plan.targetRows, transferred: 0,
        inserted: 0, updated: 0, repairedDuplicates: 0, verified: 0
      };

      await streamTable(source, table, sourceTable.columns, sourceTable.primaryKey, options.batchSize, async rows => {
        const prepared = repairDuplicatesInBatch(rows, rewritePlans, seen, counters);
        if (plan.targetRows > 0 && options.mode === 'commit' && options.conflictPolicy === 'abort') {
          const existing = await countExisting(target, table, sourceTable.primaryKey, columns, prepared);
          if (existing) {
            const matched = await countExactMatches(target, table, columns, sourceTable.primaryKey, prepared);
            if (existing > matched) {
              throw new TransferGuardError(
                'duplicate-conflict',
                'Neon already holds ' + (existing - matched) + ' row(s) in "' + table +
                '" whose primary key exists in the legacy data but whose values differ. ' +
                'Choose LEGACY_TRANSFER_CONFLICT=skip or replace after reviewing the difference.'
              );
            }
          }
        }
        const outcome = await transferBatch(
          target, table, columns, sourceTable.primaryKey, prepared, options.conflictPolicy
        );
        if (outcome.verified !== prepared.length) {
          const existingAfter = await countExisting(target, table, sourceTable.primaryKey, columns, prepared);
          throw new TransferGuardError(
            'verify-failed',
            'Exact verification failed for "' + table + '": only ' + outcome.verified + ' of ' + prepared.length +
            ' source rows match Neon after copying (' + existingAfter + ' matching key(s) already existed in Neon' +
            ', ' + outcome.verified + ' matched exactly). No rows were committed.\n' +
            '  Most likely Neon already holds different rows with the same primary keys.\n' +
            '  Review them, then re-run with LEGACY_TRANSFER_CONFLICT=replace (accept legacy values for those keys)' +
            ' or LEGACY_TRANSFER_CONFLICT=skip (keep the Neon values).'
          );
        }
        result.inserted += outcome.inserted;
        result.updated += outcome.updated;
        result.verified += outcome.verified;
        result.transferred += prepared.length;
      });

      result.repairedDuplicates = counters.repaired;
      report.results.push(result);
      console.log(
        '  ' + table + ': ' + result.transferred + ' row(s) verified (' + result.inserted + ' inserted, ' +
        result.updated + ' updated' + (result.repairedDuplicates ? ', ' + result.repairedDuplicates + ' duplicate value(s) repaired' : '') + ').'
      );
    }

    // ---- final row-count reconciliation ----------------------------------
    stage = 'row-count-verification';
    const finalCounts: TableRowCount[] = [];
    for (const plan of transferPlans) {
      const result = report.results.find(entry => entry.table === plan.table)!;
      result.target = await countRows(target, plan.table);
      finalCounts.push({
        table: plan.table,
        source: result.source,
        target: result.target,
        transferred: result.transferred
      });
      if (!isRowCountConsistent(finalCounts[finalCounts.length - 1]!)) {
        throw new TransferGuardError(
          'row-count-mismatch',
          'Row count check failed for "' + plan.table + '": legacy ' + result.source +
          ', transferred ' + result.transferred + ', Neon total ' + result.target + '.'
        );
      }
    }

    const totals = summarizeCounts(finalCounts);
    report.totals = { sourceRows: totals.sourceTotal, transferredRows: report.results.reduce((sum, row) => sum + row.transferred, 0), tables: finalCounts.length };

    if (options.mode === 'commit') {
      const reset = await resetIdentitySequences(target, transferPlans.map(plan => plan.table));
      if (reset.length) fixes.push('Reset identity sequences: ' + reset.join(', '));
      await target.query('COMMIT');
      targetTx = false;
      report.result = 'committed';
      console.log(
        '\nTransfer COMMITTED. ' + report.totals.transferredRows + ' legacy row(s) across ' +
        report.totals.tables + ' table(s) verified in Neon.'
      );
    } else {
      await target.query('ROLLBACK');
      targetTx = false;
      report.result = 'clean';
      console.log(
        '\nDry run passed. ' + report.totals.transferredRows + ' legacy row(s) across ' +
        report.totals.tables + ' table(s) verified against Neon, then rolled back.'
      );
      console.log('Nothing was written. Re-run with --commit plus LEGACY_TRANSFER_COMMIT=true to apply after approval.');
    }

    await source.query('COMMIT');
    sourceTx = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.result = 'blocked';
    warnings.push('Stopped during stage "' + stage + '".');
    if (!blockers.includes(message)) blockers.push(message);
    throw error;
  } finally {
    if (targetTx) await target.query('ROLLBACK').catch(() => undefined);
    if (sourceTx) await source.query('ROLLBACK').catch(() => undefined);
    await target.end().catch(() => undefined);
    await source.end().catch(() => undefined);
    await writeReport(options.reportPath, report);
  }

  return report;
}

async function writeReport(path: string | null, report: TransferReport): Promise<void> {
  if (!path) return;
  const absolute = resolve(process.cwd(), path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Transfer report written to ' + path);
}

function printPlan(plans: TablePlan[]): void {
  console.log('\nTable plan');
  console.log('  ' + 'table'.padEnd(30) + 'legacy'.padStart(8) + 'neon'.padStart(8) + '  action');
  for (const plan of plans) {
    console.log(
      '  ' + plan.table.padEnd(30) + String(plan.sourceRows).padStart(8) + String(plan.targetRows).padStart(8) +
      '  ' + plan.action + (plan.duplicates.length ? ' (duplicates: ' + plan.duplicates.length + ')' : '')
    );
  }
  console.log('');
}
