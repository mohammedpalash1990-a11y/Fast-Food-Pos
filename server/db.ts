import 'dotenv/config';
import { Pool } from 'pg';

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('NEON_DATABASE_URL or DATABASE_URL is required');
export const pool = new Pool({ connectionString: databaseUrl, max: 15, idleTimeoutMillis: 30_000, ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: true } : process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
pool.on('error', error => console.error('Unexpected PostgreSQL pool error', error));
export async function inTransaction<T>(work: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
