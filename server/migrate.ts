import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool, types } from 'pg';
import { pool } from './db.js';

const targetUrl = process.env.NEON_DATABASE_URL;
const sourceUrl = process.env.DATABASE_URL;
const commitLegacyTransfer = process.env.LEGACY_TRANSFER_COMMIT === 'true';

const sameDatabase = (left: string, right: string) => {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const portA = a.port || '5432';
    const portB = b.port || '5432';
    return a.protocol === b.protocol &&
      a.hostname.toLowerCase() === b.hostname.toLowerCase() &&
      portA === portB &&
      decodeURIComponent(a.pathname) === decodeURIComponent(b.pathname);
  } catch {
    return left === right;
  }
};

if (targetUrl && sourceUrl && sameDatabase(targetUrl, sourceUrl)) {
  throw new Error('Legacy source and Neon target resolve to the same PostgreSQL database. Transfer and migration stopped to protect the source database.');
}
if (commitLegacyTransfer && (!targetUrl || !sourceUrl)) {
  throw new Error('LEGACY_TRANSFER_COMMIT=true requires separate DATABASE_URL (legacy source) and NEON_DATABASE_URL (destination) values.');
}

const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';

// Always prepare the Neon schema before an optional legacy transfer.
for (const file of ['001_initial.sql', '002_team_payroll.sql', '003_reservations.sql', '004_restaurant_tables.sql', '005_delivery_dispatch.sql']) {
  const migration = await readFile(new URL('../db/migrations/' + file, import.meta.url), 'utf8');
  await pool.query(migration);
  console.log('Database migration applied: ' + file);
}

const getPrimaryKeyColumns = async (client: import('pg').PoolClient, table: string) => {
  const result = await client.query<{column_name:string}>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
     WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [table]
  );
  return result.rows.map(row => row.column_name);
};

if (targetUrl && sourceUrl && targetUrl !== sourceUrl) {
  const source = new Pool({
    connectionString: sourceUrl,
    max: 2,
    types: {
      getTypeParser: (oid, format) => {
        // Preserve PostgreSQL timestamp microseconds; JavaScript Date only retains milliseconds.
        if (oid === 1114 || oid === 1184) return (value: string) => value;
        return types.getTypeParser(oid, format);
      }
    }
  });
  let sourceClient: import('pg').PoolClient | undefined;
  let targetClient: import('pg').PoolClient | undefined;
  let sourceTransactionStarted = false;
  let targetTransactionStarted = false;
  const tableOrder = [
    'organizations', 'branches', 'users', 'categories', 'suppliers', 'customers',
    'ingredients', 'products', 'recipes', 'orders', 'order_items', 'payments',
    'purchases', 'purchase_items', 'purchase_payment_allocations',
    'stock_movements', 'audit_logs', 'expenses', 'employees',
    'employee_attendance', 'salary_advances', 'payroll_records', 'payroll_payments', 'reservations', 'restaurant_tables'
  ];
  let synchronized = 0;
  let verified = 0;

  try {
    sourceClient = await source.connect();
    targetClient = await pool.connect();
    await sourceClient.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    sourceTransactionStarted = true;
    await targetClient.query('BEGIN');
    targetTransactionStarted = true;

    const sourceTables = await sourceClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const targetTables = await targetClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const sourceSet = new Set(sourceTables.rows.map(row => row.table_name));
    const targetSet = new Set(targetTables.rows.map(row => row.table_name));
    const migrationMetadataTables = new Set([
      'knex_migrations', 'knex_migrations_lock', 'schema_migrations', '_prisma_migrations'
    ]);
    const unsupportedTables = [...sourceSet].filter(
      table => !tableOrder.includes(table) && !migrationMetadataTables.has(table)
    );
    if (unsupportedTables.length) {
      throw new Error(
        'Legacy database contains tables not covered by the transfer: ' +
        unsupportedTables.join(', ') + '. No transfer rows were committed.'
      );
    }

    for (const table of tableOrder) {
      if (!sourceSet.has(table)) continue;
      if (!targetSet.has(table)) {
        throw new Error(
          'Target schema is missing source table "' + table +
          '". Apply the database migration before transferring data.'
        );
      }

      const [sourceColumns, targetColumns, sourceKeys, targetKeys] = await Promise.all([
        sourceClient.query<{column_name:string}>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table]
        ),
        targetClient.query<{column_name:string}>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table]
        ),
        getPrimaryKeyColumns(sourceClient, table),
        getPrimaryKeyColumns(targetClient, table)
      ]);

      if (!sourceKeys.length || sourceKeys.join('\0') !== targetKeys.join('\0')) {
        throw new Error('Primary-key schema mismatch for "' + table + '". Transfer stopped before commit.');
      }

      const targetColumnSet = new Set(targetColumns.rows.map(row => row.column_name));
      const missingColumns = sourceColumns.rows
        .map(row => row.column_name)
        .filter(column => !targetColumnSet.has(column));
      if (missingColumns.length) {
        throw new Error(
          'Target table "' + table + '" is missing source columns: ' +
          missingColumns.join(', ') + '. No transfer rows were committed.'
        );
      }

      const columns = sourceColumns.rows.map(row => row.column_name);
      if (!columns.length || !sourceKeys.every(key => columns.includes(key))) {
        throw new Error('No compatible primary-key columns for "' + table + '". Transfer stopped before commit.');
      }

      const updateColumns = columns.filter(column => !sourceKeys.includes(column));
      const conflictAction = updateColumns.length
        ? 'DO UPDATE SET ' + updateColumns
          .map(column => quote(column) + '=EXCLUDED.' + quote(column))
          .join(',')
        : 'DO NOTHING';

      let offset = 0;
      let tableVerified = 0;

      while (true) {
        const result = await sourceClient.query(
          'SELECT ' + columns.map(quote).join(',') +
          ' FROM ' + quote('public') + '.' + quote(table) +
          ' ORDER BY ' + sourceKeys.map(quote).join(',') +
          ' LIMIT 300 OFFSET $1',
          [offset]
        );
        if (!result.rows.length) break;

        const insertValues: unknown[] = [];
        const insertTuples = result.rows.map((row: Record<string, unknown>) => {
          const marks = columns.map(column => {
            insertValues.push(row[column]);
            return '$' + insertValues.length;
          });
          return '(' + marks.join(',') + ')';
        });

        const insert = 'INSERT INTO ' + quote('public') + '.' + quote(table) +
          ' (' + columns.map(quote).join(',') + ') VALUES ' + insertTuples.join(',') +
          ' ON CONFLICT (' + sourceKeys.map(quote).join(',') + ') ' + conflictAction;
        const inserted = await targetClient.query(insert, insertValues);
        synchronized += inserted.rowCount || 0;

        const verifyValues: unknown[] = [];
        const verifyTuples = result.rows.map((row: Record<string, unknown>) => {
          const marks = columns.map(column => {
            verifyValues.push(row[column]);
            return '$' + verifyValues.length;
          });
          return '(' + marks.join(',') + ')';
        });
        const keyJoin = sourceKeys.map(column =>
          'persisted.' + quote(column) + '=incoming.' + quote(column)
        ).join(' AND ');
        const valueMatch = columns.map(column =>
          'persisted.' + quote(column) + ' IS NOT DISTINCT FROM incoming.' + quote(column)
        ).join(' AND ');

        const matched = await targetClient.query<{matched:string}>(
          'SELECT COUNT(*)::text AS matched FROM (VALUES ' + verifyTuples.join(',') +
          ') AS incoming(' + columns.map(quote).join(',') + ') JOIN ' +
          quote('public') + '.' + quote(table) + ' AS persisted ON ' + keyJoin +
          ' WHERE ' + valueMatch,
          verifyValues
        );
        if (Number(matched.rows[0].matched) !== result.rows.length) {
          throw new Error(
            'Exact data verification failed for "' + table + '": only ' +
            matched.rows[0].matched + ' of ' + result.rows.length +
            ' source rows match Neon after synchronization. No transfer rows were committed.'
          );
        }

        tableVerified += result.rows.length;
        offset += result.rows.length;
        if (result.rows.length < 300) break;
      }

      verified += tableVerified;
      console.log('Verified ' + tableVerified + ' source rows in ' + table + '.');
    }

    if (commitLegacyTransfer) {
      await targetClient.query('COMMIT');
      targetTransactionStarted = false;
      console.log(
        'Legacy Render to Neon transfer committed. Rows inserted or synchronized: ' +
        synchronized + '; source rows verified: ' + verified + '.'
      );
    } else {
      await targetClient.query('ROLLBACK');
      targetTransactionStarted = false;
      console.log(
        'Legacy Render to Neon dry run passed. Rows that would be inserted or synchronized: ' +
        synchronized + '; source rows verified: ' + verified +
        '. Target transaction rolled back. Set LEGACY_TRANSFER_COMMIT=true only when ready to apply the transfer.'
      );
    }

    await sourceClient.query('COMMIT');
    sourceTransactionStarted = false;
  } catch (error) {
    if (targetTransactionStarted && targetClient) await targetClient.query('ROLLBACK');
    if (sourceTransactionStarted && sourceClient) await sourceClient.query('ROLLBACK');
    throw error;
  } finally {
    targetClient?.release();
    sourceClient?.release();
    await source.end();
  }
} else {
  console.log('Legacy transfer skipped: source or Neon connection is not configured.');
}

await pool.end();
