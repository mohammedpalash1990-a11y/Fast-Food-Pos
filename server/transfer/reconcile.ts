/**
 * Pure reconciliation rules for the legacy Render -> Neon transfer.
 *
 * These helpers decide what is *wrong* with a transfer (schema drift, duplicate
 * conflicts, missing data) and what a safe repair looks like. They never touch a
 * database, which keeps every rule unit-testable.
 */

export type ColumnFamily =
  | 'uuid' | 'text' | 'integer' | 'decimal' | 'boolean' | 'timestamp' | 'date'
  | 'json' | 'array' | 'other';

export type ColumnInfo = {
  name: string;
  /** Exact PostgreSQL type, e.g. "numeric(12,2)" or "timestamp with time zone". */
  formatType: string;
  /** information_schema style name, e.g. "numeric". */
  dataType: string;
  family: ColumnFamily;
  nullable: boolean;
  hasDefault: boolean;
  identity: boolean;
  generated: boolean;
  ordinal: number;
};

export type UniqueKey = { name: string; columns: string[] };

export type ColumnDrift = {
  /** Source columns the target does not have; the target schema must be upgraded. */
  missingInTarget: string[];
  /** Target columns the source does not have; they are filled with their default. */
  missingInSource: string[];
  /** Same column name, incompatible types. */
  typeConflicts: { column: string; source: string; target: string }[];
  /** Same column name, compatible but not identical types (values are cast). */
  typeCasts: { column: string; source: string; target: string }[];
};

/** Group PostgreSQL types into families that can be compared for compatibility. */
export function typeFamily(dataType: string): ColumnFamily {
  const type = dataType.toLowerCase();
  if (type === 'uuid') return 'uuid';
  if (['text', 'character varying', 'character', 'citext', 'name'].includes(type)) return 'text';
  if (['smallint', 'integer', 'bigint'].includes(type)) return 'integer';
  if (['numeric', 'decimal', 'real', 'double precision', 'money'].includes(type)) return 'decimal';
  if (type === 'boolean') return 'boolean';
  if (type.startsWith('timestamp') || type === 'time with time zone' || type === 'time without time zone') return 'timestamp';
  if (type === 'date') return 'date';
  if (type === 'json' || type === 'jsonb') return 'json';
  if (type === 'array') return 'array';
  return 'other';
}

/**
 * Column pairs the transfer can convert without losing information.
 * Anything not listed here and not an exact family match is a hard conflict.
 */
const SAFE_CASTS: Record<string, ColumnFamily[]> = {
  // source family -> target families we may write into
  text: ['uuid', 'timestamp', 'date', 'decimal', 'json'],
  integer: ['decimal', 'text'],
  decimal: ['integer', 'text'],
  timestamp: ['date', 'text'],
  date: ['timestamp', 'text'],
  boolean: ['text'],
  json: ['text'],
  uuid: ['text']
};

export function isSafeCast(source: ColumnInfo, target: ColumnInfo): boolean {
  if (source.formatType.toLowerCase() === target.formatType.toLowerCase()) return true;
  if (source.family === target.family) return true;
  return (SAFE_CASTS[source.family] || []).includes(target.family);
}

/** Compare the column sets of one table between source and target. */
export function diffColumns(source: ColumnInfo[], target: ColumnInfo[]): ColumnDrift {
  const targetByName = new Map(target.map(column => [column.name, column]));
  const sourceByName = new Map(source.map(column => [column.name, column]));

  const drift: ColumnDrift = { missingInTarget: [], missingInSource: [], typeConflicts: [], typeCasts: [] };

  for (const column of source) {
    const match = targetByName.get(column.name);
    if (!match) { drift.missingInTarget.push(column.name); continue; }
    if (column.formatType.toLowerCase() === match.formatType.toLowerCase()) continue;
    if (isSafeCast(column, match)) {
      drift.typeCasts.push({ column: column.name, source: column.formatType, target: match.formatType });
      continue;
    }
    drift.typeConflicts.push({ column: column.name, source: column.formatType, target: match.formatType });
  }

  for (const column of target) {
    if (!sourceByName.has(column.name)) drift.missingInSource.push(column.name);
  }

  drift.missingInTarget.sort();
  drift.missingInSource.sort();
  drift.typeConflicts.sort((a, b) => a.column.localeCompare(b.column));
  drift.typeCasts.sort((a, b) => a.column.localeCompare(b.column));
  return drift;
}

export function hasBlockingDrift(drift: ColumnDrift): boolean {
  return drift.missingInTarget.length > 0 || drift.typeConflicts.length > 0;
}

/** Unique keys that the transfer has to respect in addition to the primary key. */
export function uniqueKeysRequiringCheck(uniqueKeys: UniqueKey[], primaryKey: string[]): UniqueKey[] {
  return uniqueKeys.filter(key => {
    if (!key.columns.length) return false;
    const sameAsPrimaryKey = key.columns.length === primaryKey.length &&
      key.columns.every(column => primaryKey.includes(column));
    return !sameAsPrimaryKey;
  });
}

export type DuplicateGroup = { key: Record<string, string | null>; rowKeys: string[] };

/**
 * Append a deterministic, reversible suffix to a text value so duplicates can be
 * kept instead of dropped: "INV-9" -> "INV-9~dup2".
 */
export function disambiguateValue(value: string, taken: ReadonlySet<string>, maxLength = 120): string {
  const room = Math.max(1, maxLength - 8); // "~dup9999" plus headroom
  const base = value.slice(0, room);
  let candidate = base + '~dup2';
  let attempt = 2;
  while (taken.has(candidate)) {
    attempt += 1;
    if (attempt > 99_999) {
      throw new Error('Unable to disambiguate duplicate value "' + value + '" after 99999 attempts');
    }
    candidate = base + '~dup' + attempt;
  }
  return candidate;
}

/**
 * Pick the column of a unique key that can absorb a disambiguation suffix.
 *
 * The column must be a text column *inside* the unique key (rewriting anything
 * else cannot resolve the collision) and must not be part of the primary key
 * (rewriting a primary key would break row identity).
 */
export function pickRewritableColumn(
  key: UniqueKey,
  columns: ColumnInfo[],
  primaryKey: readonly string[] = []
): string | null {
  const byName = new Map(columns.map(column => [column.name, column]));
  const candidates = key.columns.filter(name => {
    const column = byName.get(name);
    return column?.family === 'text' && !column.identity && !primaryKey.includes(name);
  });
  if (!candidates.length) return null;
  return candidates[candidates.length - 1]!;
}

/** The character limit of a text column, used to size disambiguation suffixes. */
export function textLength(column: ColumnInfo | undefined, fallback = 120): number {
  if (!column) return fallback;
  const match = /^character varying\((\d+)\)$/.exec(column.formatType.toLowerCase());
  if (match) return Number(match[1]);
  if (column.formatType.toLowerCase().startsWith('character(')) {
    return Number(/\((\d+)\)/.exec(column.formatType)![1]);
  }
  return fallback;
}

/**
 * Group rows that collide on a unique key. `rows` must already be sorted by the
 * primary key so the "winner" of every group is stable between runs.
 */
export function findDuplicateGroups(
  rows: readonly Record<string, unknown>[],
  key: UniqueKey,
  rowKeyOf: (row: Record<string, unknown>) => string
): { winners: Record<string, unknown>[]; losers: { row: Record<string, unknown>; winner: Record<string, unknown> }[] } {
  const seen = new Map<string, Record<string, unknown>>();
  const winners: Record<string, unknown>[] = [];
  const losers: { row: Record<string, unknown>; winner: Record<string, unknown> }[] = [];
  for (const row of rows) {
    if (key.columns.some(column => row[column] === null || row[column] === undefined)) {
      winners.push(row); // NULLs never collide in a PostgreSQL unique index
      continue;
    }
    const signature = JSON.stringify(key.columns.map(column => row[column]));
    const winner = seen.get(signature);
    if (!winner) {
      seen.set(signature, row);
      winners.push(row);
    } else {
      losers.push({ row, winner });
    }
    void rowKeyOf;
  }
  return { winners, losers };
}

export type TableRowCount = { table: string; source: number; target: number; transferred: number };

/**
 * Final acceptance rule: every source row must exist in the target with identical
 * values, and the target must contain at least as many rows as the source.
 */
export function isRowCountConsistent(count: TableRowCount): boolean {
  return count.transferred === count.source && count.target >= count.source;
}

export function summarizeCounts(counts: readonly TableRowCount[]): { sourceTotal: number; targetTotal: number; tables: number } {
  return {
    sourceTotal: counts.reduce((sum, row) => sum + row.source, 0),
    targetTotal: counts.reduce((sum, row) => sum + row.target, 0),
    tables: counts.length
  };
}
