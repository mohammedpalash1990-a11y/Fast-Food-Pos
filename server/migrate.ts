import { readFile } from 'node:fs/promises';
import { pool } from './db.js';
const sql = await readFile(new URL('../db/migrations/001_initial.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Database migration applied.');
await pool.end();
