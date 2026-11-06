import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { pool } from './db.js';

const targetUrl = process.env.NEON_DATABASE_URL;
const sourceUrl = process.env.DATABASE_URL;

const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';

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
  const source = new Pool({ connectionString: sourceUrl, max: 2 });
  const sourceClient = await source.connect();
  const targetClient = await pool.connect();
  const tableOrder = [
    'organizations', 'branches', 'users', 'categories', 'suppliers', 'customers',
    'ingredients', 'products', 'recipes', 'orders', 'order_items', 'payments',
    'purchases', 'purchase_items', 'purchase_payment_allocations',
    'stock_movements', 'audit_logs'
  ];
  let copied = 0;
  let verified = 0;
  try {
    await sourceClient.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await targetClient.query('BEGIN');
    const sourceTables = await sourceClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const targetTables = await targetClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const sourceSet = new Set(sourceTables.rows.map(row => row.table_name));
    const targetSet = new Set(targetTables.rows.map(row => row.table_name));

    for (const table of tableOrder) {
      if (!sourceSet.has(table)) continue;
      if (!targetSet.has(table)) {
        throw new Error(`Target schema is missing source table "${table}". Apply the database migration before transferring data.`);
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
        throw new Error(`Primary-key schema mismatch for "${table}". Transfer stopped before commit.`);
      }
      const targetColumnSet = new Set(targetColumns.rows.map(row => row.column_name));
      const columns = sourceColumns.rows.map(row => row.column_name).filter(name => targetColumnSet.has(name));
      if (!columns.length || !sourceKeys.every(key => columns.includes(key))) {
        throw new Error(`No compatible primary-key columns for "${table}". Transfer stopped before commit.`);
      }

      let offset = 0;
      let tableVerified = 0;
      while (true) {
        const result = await sourceClient.query(
          'SELECT ' + columns.map(quote).join(',') + ' FROM ' + quote('public') + '.' + quote(table) +
            ' ORDER BY ' + columns.map(quote).join(',') + ' LIMIT 300 OFFSET $1',
          [offset]
        );
        if (!result.rows.length) break;

        const values: unknown[] = [];
        const tuples = result.rows.map((row: Record<string, unknown>) => {
          const marks = columns.map(column => {
            values.push(row[column]);
            return '$' + values.length;
          });
          return '(' + marks.join(',') + ')';
        });
        const insert = 'INSERT INTO ' + quote('public') + '.' + quote(table) +
          ' (' + columns.map(quote).join(',') + ') VALUES ' + tuples.join(',') + ' ON CONFLICT DO NOTHING';
        const inserted = await targetClient.query(insert, values);
        copied += inserted.rowCount || 0;

        const keyValues: unknown[] = [];
        const keyTuples = result.rows.map((row: Record<string, unknown>) => {
          const marks = sourceKeys.map(column => {
            keyValues.push(row[column]);
            return '$' + keyValues.length;
          });
          return '(' + marks.join(',') + ')';
        });
        const keyExpression = sourceKeys.length === 1
          ? quote(sourceKeys[0])
          : '(' + sourceKeys.map(quote).join(',') + ')';
        const matched = await targetClient.query<{matched:string}>(
          'SELECT COUNT(*)::text AS matched FROM ' + quote('public') + '.' + quote(table) +
            ' WHERE ' + keyExpression + ' IN (VALUES ' + keyTuples.join(',') + ')',
          keyValues
        );
        if (Number(matched.rows[0].matched) !== result.rows.length) {
          throw new Error(
            `Transfer conflict in "${table}": only ${matched.rows[0].matched} of ${result.rows.length} source rows are present in Neon. No transfer rows were committed.`
          );
        }
        tableVerified += result.rows.length;
        offset += result.rows.length;
        if (result.rows.length < 300) break;
      }
      verified += tableVerified;
      console.log(`Verified ${tableVerified} source rows in ${table}.`);
    }

    await targetClient.query('COMMIT');
    await sourceClient.query('COMMIT');
    console.log(`Legacy Render to Neon transfer finished. Newly inserted rows: ${copied}; source rows verified: ${verified}.`);
  } catch (error) {
    await targetClient.query('ROLLBACK');
    await sourceClient.query('ROLLBACK');
    throw error;
  } finally {
    targetClient.release();
    sourceClient.release();
    await source.end();
  }
} else {
  console.log('Legacy transfer skipped: source or Neon connection is not configured.');
}

const sql = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Database migration applied.');
await pool.end();
