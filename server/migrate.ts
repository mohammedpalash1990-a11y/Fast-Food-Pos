import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { pool } from './db.js';

const targetUrl = process.env.NEON_DATABASE_URL;
const sourceUrl = process.env.DATABASE_URL;

const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';

// Always make the target schema usable before attempting an optional legacy transfer.
// A temporary outage or network allowlist on the old database must not prevent the
// production API from starting against Neon.
for (const file of ['001_initial.sql', '002_team_payroll.sql']) {
  const sql = await readFile(new URL('../db/migrations/' + file, import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Database migration applied: ' + file);
}

if (targetUrl && sourceUrl && targetUrl !== sourceUrl) {
  const source = new Pool({ connectionString: sourceUrl, max: 2, connectionTimeoutMillis: 5000 });
  let sourceClient: import('pg').PoolClient | undefined;
  let targetClient: import('pg').PoolClient | undefined;
  try {
    sourceClient = await source.connect();
    targetClient = await pool.connect();
    const tableOrder = [
      'organizations', 'branches', 'users', 'categories', 'suppliers', 'customers',
      'ingredients', 'products', 'recipes', 'orders', 'order_items', 'payments',
      'purchases', 'purchase_items', 'stock_movements', 'audit_logs'
    ];
    let copied = 0;
    const sourceTables = await sourceClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const targetTables = await targetClient.query<{table_name:string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
    );
    const sourceSet = new Set(sourceTables.rows.map(row => row.table_name));
    const targetSet = new Set(targetTables.rows.map(row => row.table_name));
    await targetClient.query('BEGIN');
    for (const table of tableOrder) {
      if (!sourceSet.has(table) || !targetSet.has(table)) continue;
      const [sourceColumns, targetColumns] = await Promise.all([
        sourceClient.query<{column_name:string}>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table]
        ),
        targetClient.query<{column_name:string}>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table]
        )
      ]);
      const targetColumnSet = new Set(targetColumns.rows.map(row => row.column_name));
      const columns = sourceColumns.rows.map(row => row.column_name).filter(name => targetColumnSet.has(name));
      if (!columns.length) continue;
      let offset = 0;
      while (true) {
        const result = await sourceClient.query(
          'SELECT ' + columns.map(quote).join(',') + ' FROM ' + quote('public') + '.' + quote(table) + ' ORDER BY 1 LIMIT 300 OFFSET $1',
          [offset]
        );
        if (!result.rows.length) break;
        const values: unknown[] = [];
        const tuples = result.rows.map((row: Record<string, unknown>, rowIndex: number) => {
          const marks = columns.map((_, columnIndex) => {
            values.push(row[columns[columnIndex]]);
            return '$' + (rowIndex * columns.length + columnIndex + 1);
          });
          return '(' + marks.join(',') + ')';
        });
        const insert = 'INSERT INTO ' + quote('public') + '.' + quote(table) +
          ' (' + columns.map(quote).join(',') + ') VALUES ' + tuples.join(',') + ' ON CONFLICT DO NOTHING';
        const inserted = await targetClient.query(insert, values);
        copied += inserted.rowCount || 0;
        offset += result.rows.length;
        if (result.rows.length < 300) break;
      }
    }
    await targetClient.query('COMMIT');
    console.log('Legacy Render to Neon transfer finished. Newly inserted rows: ' + copied);
  } catch (error) {
    if (targetClient) {
      try { await targetClient.query('ROLLBACK'); } catch { /* transaction may not have started */ }
    }
    console.error(
      'WARNING: Legacy Render to Neon transfer did not finish. The Neon schema is migrated and the API can start, but legacy data remains unverified. Keep the old database; retry transfer after its network access is restored.',
      error
    );
  } finally {
    targetClient?.release();
    sourceClient?.release();
    await source.end();
  }
} else {
  console.log('Legacy transfer skipped: source or Neon connection is not configured.');
}

await pool.end();
