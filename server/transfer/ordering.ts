/**
 * Foreign-key aware insert ordering.
 *
 * Transferring rows with a hard-coded table list is fragile: a table that gains a
 * new foreign key (for example orders.table_id -> restaurant_tables) silently
 * breaks the transfer. We therefore derive the order from the destination's own
 * foreign keys.
 */

export type ForeignKeyEdge = { table: string; references: string };

export type OrderingResult = {
  order: string[];
  /** Tables that form a dependency cycle and cannot be inserted without deferring. */
  cycles: string[][];
};

/**
 * Topologically sort tables so a referenced table is always written first.
 * `preference` keeps the output stable (matches the historical table order).
 */
export function orderTablesByForeignKeys(
  tables: readonly string[],
  edges: readonly ForeignKeyEdge[],
  preference: readonly string[] = []
): OrderingResult {
  const members = new Set(tables);
  const rank = new Map<string, number>();
  preference.forEach((name, index) => rank.set(name, index));
  const fallbackRank = (name: string) => rank.get(name) ?? Number.MAX_SAFE_INTEGER;

  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const name of members) {
    dependencies.set(name, new Set());
    dependents.set(name, new Set());
  }

  for (const edge of edges) {
    // Self references are satisfied by the row itself only when the row is
    // inserted with a deferred constraint, so they are reported as a cycle.
    if (!members.has(edge.table) || !members.has(edge.references)) continue;
    dependencies.get(edge.table)!.add(edge.references);
    dependents.get(edge.references)!.add(edge.table);
  }

  const remaining = new Map<string, number>();
  for (const name of members) remaining.set(name, dependencies.get(name)!.size);

  const ready = [...members]
    .filter(name => remaining.get(name) === 0)
    .sort((a, b) => fallbackRank(a) - fallbackRank(b) || a.localeCompare(b));

  const order: string[] = [];
  while (ready.length) {
    const next = ready.shift()!;
    order.push(next);
    for (const dependent of [...dependents.get(next)!].sort()) {
      const left = remaining.get(dependent)! - 1;
      remaining.set(dependent, left);
      if (left === 0) {
        ready.push(dependent);
        ready.sort((a, b) => fallbackRank(a) - fallbackRank(b) || a.localeCompare(b));
      }
    }
  }

  const cycles: string[][] = [];
  const blocked = [...members].filter(name => !order.includes(name)).sort();
  if (blocked.length) cycles.push(blocked);

  return { order, cycles };
}

/** Stable order used as a tie-breaker so reports are diffable between runs. */
export const PREFERRED_TABLE_ORDER = [
  'organizations', 'branches', 'users', 'categories', 'suppliers', 'customers',
  'ingredients', 'products', 'recipes', 'restaurant_tables', 'orders', 'order_items',
  'payments', 'purchases', 'purchase_items', 'purchase_payment_allocations',
  'stock_movements', 'audit_logs', 'expenses', 'employees', 'employee_attendance',
  'salary_advances', 'payroll_records', 'payroll_payments', 'reservations', 'deliveries'
] as const;

/** Tables that hold migration bookkeeping rather than application data. */
export const MIGRATION_METADATA_TABLES = [
  'knex_migrations', 'knex_migrations_lock', 'schema_migrations', '_prisma_migrations'
] as const;
