/**
 * PostgreSQL test helpers.
 *
 * Integration tests need a real server. They read LEGACY_TEST_DATABASE_URL and
 * NEON_TEST_DATABASE_URL; when either is missing the tests skip instead of failing
 * so `npm test` stays usable on a laptop with no database.
 */
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

export const LEGACY_URL = process.env.LEGACY_TEST_DATABASE_URL;
export const NEON_URL = process.env.NEON_TEST_DATABASE_URL;

export const hasDatabases = Boolean(LEGACY_URL && NEON_URL);
export const skipWithoutDatabases = hasDatabases
  ? false
  : 'LEGACY_TEST_DATABASE_URL and NEON_TEST_DATABASE_URL are required for transfer integration tests';

/** Scratch databases keep parallel runs from colliding. */
export function scratchName(prefix: string): string {
  return prefix + '_' + randomBytes(4).toString('hex');
}

function adminUrl(url: string): { admin: string; database: string } {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  return { admin: admin.toString(), database };
}

export async function createDatabase(url: string, prefix: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const { admin, database } = adminUrl(url);
  const name = scratchName(prefix);
  const root = new Client({ connectionString: admin });
  await root.connect();
  await root.query('CREATE DATABASE "' + name + '"');
  await root.end();
  const target = new URL(url);
  target.pathname = '/' + name;
  void database;
  return {
    url: target.toString(),
    drop: async () => {
      const cleanup = new Client({ connectionString: admin });
      await cleanup.connect();
      await cleanup.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
      await cleanup.end();
    }
  };
}

/** Wipe a database so each test starts from an empty schema. */
export async function resetSchema(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();
}
