/**
 * Parsing and safety guards for the legacy Render -> Neon PostgreSQL transfer.
 *
 * Everything in this module is pure (no database access) so the guard rails can
 * be unit tested without a live PostgreSQL instance.
 */

export type TransferMode = 'dry-run' | 'commit';
export type ConflictPolicy = 'abort' | 'skip' | 'replace';

export type TransferOptions = {
  mode: TransferMode;
  sourceUrl: string;
  targetUrl: string;
  batchSize: number;
  /** Table names to transfer. Empty means "every supported table". */
  tables: string[];
  conflictPolicy: ConflictPolicy;
  /** Collapse duplicate values that the destination requires to be unique. */
  repairDuplicates: boolean;
  /** Allow legacy tables that the Neon schema does not know about. */
  allowUnsupportedTables: boolean;
  /** Create nullable missing columns on the target instead of aborting. */
  addMissingColumns: boolean;
  /** Legacy tables that are intentionally not transferred. */
  ignoreTables: string[];
  /** Explicitly apply db/migrations/*.sql to the target before comparing. */
  applySchema: boolean;
  reportPath: string | null;
};

export class TransferGuardError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TransferGuardError';
    this.code = code;
  }
}

const DEFAULT_BATCH_SIZE = 300;
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 2000;

/** Hide the password so reports and logs can safely include a connection string. */
export function redactUrl(raw: string | undefined | null): string {
  if (!raw) return '(not configured)';
  try {
    const url = new URL(raw);
    const password = url.password ? '***' : '';
    const user = url.username ? url.username + (password ? ':' + password : '') + '@' : '';
    const port = url.port ? ':' + url.port : '';
    return url.protocol + '//' + user + url.hostname + port + decodeURIComponent(url.pathname);
  } catch {
    return '(unparseable connection string)';
  }
}

type NormalizedDb = { host: string; port: string; database: string };

function normalizeDatabase(raw: string): NormalizedDb | null {
  try {
    const url = new URL(raw);
    const protocol = url.protocol.replace(/:$/, '');
    if (protocol !== 'postgres' && protocol !== 'postgresql') return null;
    const database = decodeURIComponent(url.pathname || '').replace(/^\//, '') || 'postgres';
    return {
      host: url.hostname.toLowerCase(),
      port: url.port || '5432',
      database
    };
  } catch {
    return null;
  }
}

/** True when both connection strings point at the very same database. */
export function isSameDatabase(left: string, right: string): boolean {
  const a = normalizeDatabase(left);
  const b = normalizeDatabase(right);
  if (!a || !b) return left === right;
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

/** True when both connections live on the same server (different databases allowed). */
export function isSameServer(left: string, right: string): boolean {
  const a = normalizeDatabase(left);
  const b = normalizeDatabase(right);
  if (!a || !b) return left === right;
  return a.host === b.host && a.port === b.port;
}

function parseBatchSize(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_BATCH_SIZE;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < MIN_BATCH_SIZE || value > MAX_BATCH_SIZE) {
    throw new TransferGuardError(
      'invalid-batch-size',
      'LEGACY_TRANSFER_BATCH_SIZE must be a whole number between ' + MIN_BATCH_SIZE + ' and ' + MAX_BATCH_SIZE + '.'
    );
  }
  return value;
}

function parseConflictPolicy(raw: string | undefined): ConflictPolicy {
  const value = (raw || 'abort').trim().toLowerCase();
  if (value === 'abort' || value === 'skip' || value === 'replace') return value;
  throw new TransferGuardError(
    'invalid-conflict-policy',
    'LEGACY_TRANSFER_CONFLICT must be one of abort, skip or replace (received "' + raw + '").'
  );
}

/**
 * Build transfer options from argv + environment.
 *
 * A real transfer requires two independent switches:
 *   --commit  (on the command line)  AND  LEGACY_TRANSFER_COMMIT=true (environment)
 * so a stray environment variable alone can never write to Neon.
 */
export function parseTransferOptions(
  argv: readonly string[],
  env: Record<string, string | undefined>
): TransferOptions {
  const flags = new Set(argv.filter(arg => arg.startsWith('--')).map(arg => arg.toLowerCase()));
  const requestedCommit = flags.has('--commit');
  const envCommit = (env.LEGACY_TRANSFER_COMMIT || '').trim().toLowerCase() === 'true';

  const sourceUrl = (env.DATABASE_URL || '').trim();
  const targetUrl = (env.NEON_DATABASE_URL || '').trim();

  if (!sourceUrl && !targetUrl) {
    throw new TransferGuardError(
      'not-configured',
      'Neither DATABASE_URL (legacy Render source) nor NEON_DATABASE_URL (Neon target) is set; nothing to transfer.'
    );
  }
  if (!targetUrl) {
    throw new TransferGuardError(
      'missing-target',
      'NEON_DATABASE_URL is required as the transfer destination; refusing to guess a target database.'
    );
  }
  if (!sourceUrl) {
    throw new TransferGuardError(
      'missing-source',
      'DATABASE_URL (the legacy Render source) is required for a transfer. Use npm run db:migrate to apply schema only.'
    );
  }
  if (isSameDatabase(sourceUrl, targetUrl)) {
    throw new TransferGuardError(
      'source-target-collision',
      'Legacy source and Neon target resolve to the same database (' + redactUrl(targetUrl) +
        '). The transfer was stopped to protect the source database.'
    );
  }

  const applySchema = flags.has('--apply-schema') || flag(env, 'LEGACY_TRANSFER_APPLY_SCHEMA');
  const mode: TransferMode = requestedCommit ? 'commit' : 'dry-run';
  if (requestedCommit && !envCommit) {
    throw new TransferGuardError(
      'commit-not-confirmed',
      'Commit requested with --commit but LEGACY_TRANSFER_COMMIT is not "true". ' +
        'Review a successful dry run first, then set LEGACY_TRANSFER_COMMIT=true to approve the real migration.'
    );
  }
  if (!requestedCommit && envCommit) {
    // Environment alone is not enough: the operator must also pass --commit.
    return {
      mode: 'dry-run',
      sourceUrl,
      targetUrl,
      batchSize: parseBatchSize(env.LEGACY_TRANSFER_BATCH_SIZE),
      tables: parseTables(env.LEGACY_TRANSFER_TABLES),
      conflictPolicy: parseConflictPolicy(env.LEGACY_TRANSFER_CONFLICT),
      repairDuplicates: flag(env, 'LEGACY_TRANSFER_REPAIR_DUPLICATES'),
      allowUnsupportedTables: flag(env, 'LEGACY_TRANSFER_ALLOW_UNSUPPORTED_TABLES'),
      addMissingColumns: flag(env, 'LEGACY_TRANSFER_ADD_MISSING_COLUMNS'),
      ignoreTables: parseTables(env.LEGACY_TRANSFER_IGNORE_TABLES),
      applySchema: applySchema,
      reportPath: parseReportPath(env, false)
    };
  }

  return {
    mode,
    sourceUrl,
    targetUrl,
    batchSize: parseBatchSize(env.LEGACY_TRANSFER_BATCH_SIZE),
    tables: parseTables(env.LEGACY_TRANSFER_TABLES),
    conflictPolicy: parseConflictPolicy(env.LEGACY_TRANSFER_CONFLICT),
    repairDuplicates: flag(env, 'LEGACY_TRANSFER_REPAIR_DUPLICATES'),
    allowUnsupportedTables: flag(env, 'LEGACY_TRANSFER_ALLOW_UNSUPPORTED_TABLES'),
    addMissingColumns: flag(env, 'LEGACY_TRANSFER_ADD_MISSING_COLUMNS'),
    ignoreTables: parseTables(env.LEGACY_TRANSFER_IGNORE_TABLES),
    applySchema: applySchema,
    reportPath: parseReportPath(env, mode === 'commit')
  };
}

const flag = (env: Record<string, string | undefined>, name: string): boolean =>
  (env[name] || '').trim().toLowerCase() === 'true';

function parseTables(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(Boolean);
}

function parseReportPath(env: Record<string, string | undefined>, commit: boolean): string | null {
  const explicit = (env.LEGACY_TRANSFER_REPORT || '').trim();
  if (explicit) return explicit;
  if ((env.LEGACY_TRANSFER_REPORT_DISABLED || '').trim().toLowerCase() === 'true') return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return 'reports/legacy-transfer-' + (commit ? 'commit' : 'dry-run') + '-' + stamp + '.json';
}

/** Warning lines printed before a real transfer starts. */
export function describeTransfer(options: TransferOptions): string[] {
  const lines = [
    'Legacy Render -> Neon transfer',
    '  mode:   ' + options.mode.toUpperCase() + (options.mode === 'dry-run' ? ' (source read-only, target rolled back)' : ''),
    '  source: ' + redactUrl(options.sourceUrl) + ' (read-only)',
    '  target: ' + redactUrl(options.targetUrl),
    '  batch:  ' + options.batchSize + ' rows',
    '  conflicts: ' + options.conflictPolicy + (options.repairDuplicates ? ' (duplicate repair enabled)' : '')
  ];
  lines.push('  schema: ' + (options.applySchema ? 'apply db/migrations to target first' : 'compare against the existing target schema'));
  if (options.allowUnsupportedTables) lines.push('  ! unsupported legacy tables will be ignored, not transferred');
  if (options.addMissingColumns) lines.push('  ! missing target columns will be created as nullable');
  if (options.ignoreTables.length) lines.push('  ignored tables: ' + options.ignoreTables.join(', '));
  if (options.tables.length) lines.push('  tables: ' + options.tables.join(', '));
  if (options.mode === 'commit') {
    lines.push('  !! THIS WRITES TO NEON. The legacy Render database is only ever read.');
  }
  return lines;
}
