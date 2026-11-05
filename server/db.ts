import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 15, idleTimeoutMillis: 30_000, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
pool.on('error', error => console.error('Unexpected PostgreSQL pool error', error));
export async function inTransaction<T>(work: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
