/**
 * Apply the PostgreSQL schema to the Neon target (or the local development
 * database). This command only ever writes to the schema of the database in
 * NEON_DATABASE_URL / DATABASE_URL — it never copies data.
 *
 * Copying legacy rows is a separate, guarded operation: `npm run db:transfer`.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const MIGRATION_ORDER = [
  '001_initial.sql', '002_team_payroll.sql', '003_reservations.sql', '004_restaurant_tables.sql',
  '005_delivery_dispatch.sql', '006_order_table_assignment.sql', '007_order_idempotency.sql',
  '008_payroll_hardening.sql', '009_reporting_indexes.sql', '010_branch_settings.sql', '011_discount_coupons.sql', '012_branch_configuration.sql'
];

const neonUrl = process.env.NEON_DATABASE_URL;
const legacyUrl = process.env.DATABASE_URL;

// `npm run db:migrate` against Neon while a separate legacy source is configured
// is almost always a mistake: data is not copied here, and running it against the
// legacy URL would be a schema write to production. Both cases stop the command.
if (process.env.NODE_ENV === 'production' && !neonUrl) {
  throw new Error('NEON_DATABASE_URL is required in production; refusing to fall back to the legacy DATABASE_URL.');
}
const url = neonUrl || legacyUrl;
if (!url) throw new Error('NEON_DATABASE_URL (production) or DATABASE_URL (local development) is required');

if (legacyUrl && neonUrl && new URL(legacyUrl).hostname === new URL(neonUrl).hostname &&
    new URL(legacyUrl).pathname === new URL(neonUrl).pathname) {
  throw new Error('DATABASE_URL and NEON_DATABASE_URL point at the same database; check the transfer configuration.');
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('neon.tech') ? { rejectUnauthorized: true } : process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined
});

try {
  for (const file of MIGRATION_ORDER) {
    const migration = await readFile(new URL('../db/migrations/' + file, import.meta.url), 'utf8');
    await pool.query(migration);
    console.log('Database migration applied: ' + file);
  }
  if (legacyUrl && neonUrl) {
    console.log('\nSchema only. No rows were copied from the legacy database.');
    console.log('Next: npm run db:transfer (read-only dry run), review the report, then ask for approval before --commit.');
  }
} finally {
  await pool.end();
}
