# Legacy Render → Neon transfer runbook

Production data still lives in the old **Render PostgreSQL** database; the API now
writes to **Neon PostgreSQL**. This runbook moves the data exactly once, verifies it,
and never modifies or deletes the legacy database.

## Guarantees built into the tooling

| Guarantee | How it is enforced |
| --- | --- |
| The legacy database is never written | `SET default_transaction_read_only = on` **and** `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` before any read. PostgreSQL itself rejects writes. |
| Nothing reaches Neon without approval | Default is a dry run. A real commit needs `--commit` **and** `LEGACY_TRANSFER_COMMIT=true`. |
| The source and target are never the same database | Host + port + database compared before connecting. |
| Problems are found before writing | Table inventory, primary keys, column types, uniques and duplicates checked first. Blockers stop the run with a list. |
| Every row is verified | After the copy each source row is compared to Neon with `IS NOT DISTINCT FROM` on every column, then row counts are reconciled. |
| A failure leaves no partial migration | The whole Neon side (data **and** schema changes) runs in one transaction and is rolled back on any error. |

## 1. Prepare

```sh
cp .env.example .env      # never commit .env
```

```ini
# legacy Render PostgreSQL (read-only source)
DATABASE_URL=postgresql://USER:PASSWORD@HOST.render.com:5432/DBNAME
# Neon destination
NEON_DATABASE_URL=postgresql://USER:PASSWORD@ep-....neon.tech/neondb?sslmode=require
JWT_SECRET=at-least-32-random-characters
LEGACY_TRANSFER_COMMIT=false
```

Take a Neon backup/snapshot (branch or `pg_dump`) before the commit step, and keep
the Render database untouched until the transfer has been independently verified.

## 2. Apply the schema to Neon

```sh
npm run db:migrate
```

This writes **schema only** to `NEON_DATABASE_URL`. No data is copied.

## 3. Dry run (read-only)

```sh
npm run db:transfer
```

What happens: source opens read-only → Neon transaction opens → table plan is
printed → every row is copied and verified in the Neon transaction → **rollback**.

The command exits `0` only when the dry run is clean, and writes
`reports/legacy-transfer-dry-run-<timestamp>.json` with per-table row counts, the
schema diff, detected duplicates, fixes and blockers.

### Reading the plan

```
  table                           legacy    neon  action
  organizations                        1       0  transfer
  purchases                            3       0  transfer (duplicates: 1)
  purchase_items                       0       0  skipped
```

`skipped` = the legacy table is empty, nothing to do. `blocked` = see the blocker
list; nothing will be written until it is resolved.

## 4. Fix what the dry run reports

Each blocker names the exact remedy.

| Blocker | Meaning | Fix |
| --- | --- | --- |
| `The Neon target has no application tables yet` | Schema not applied | `npm run db:migrate` (or add `--apply-schema`) |
| `Legacy database contains tables the Neon schema does not cover: x, y` | Legacy-only tables | Review them; extend `db/migrations`, or list them in `LEGACY_TRANSFER_IGNORE_TABLES`, or accept skipping with `LEGACY_TRANSFER_ALLOW_UNSUPPORTED_TABLES=true` |
| `Neon table "t" is missing legacy columns: c` | Legacy column absent in Neon | Add a migration for it, or re-run with `LEGACY_TRANSFER_ADD_MISSING_COLUMNS=true` (creates the column inside the same transaction) |
| `Incompatible column types in "t": c` | Legacy type cannot be written into the Neon type | Add an explicit cast/migration; the transfer will not guess |
| `Duplicate values in legacy "t" violate Neon unique key (...)` | Legacy rows collide on a Neon unique constraint | `LEGACY_TRANSFER_REPAIR_DUPLICATES=true` keeps **every** row by suffixing the text column (`INV-9` → `INV-9~dup2`), deterministically, in primary-key order |
| `Neon already holds N row(s) ... whose values differ` | Neon already contains a divergent row for a legacy primary key | Inspect the row; then choose `LEGACY_TRANSFER_CONFLICT=skip` (keep Neon) or `replace` (take legacy) |
| `NOT NULL without a default` | A Neon-only column cannot be filled from legacy data | Add a default or make it nullable |
| `has no primary key` | Legacy table cannot be matched row-by-row | Add a key, or exclude the table |

Re-run the dry run until it exits `0`.

## 5. Ask for approval, then commit

Post the dry-run summary (table counts + `reports/…json`) and get explicit approval.
Only then:

```sh
LEGACY_TRANSFER_COMMIT=true npm run db:transfer:commit
```

The commit runs the same verification, resets identity sequences, and commits once.
If anything fails, the Neon transaction rolls back and the legacy database is still
untouched — safe to fix and re-run.

## 6. Verify after the commit

```sh
npm run db:seed         # create/confirm the first owner in Neon (production bootstrap)
npm run api:start       # health check: GET /api/health
```

Then spot-check in the console: dashboard totals, recent orders, supplier payables
and payroll. Compare against the dry-run report — the numbers must match.

## 7. Decommission the legacy database

Only after the Neon data has been verified in the app:

1. Keep the Render database in place (read-only) for at least one full business cycle.
2. Export a final `pg_dump` to your backup store.
3. Rotate the Render credentials once the app no longer references `DATABASE_URL`.
4. Remove `DATABASE_URL` from Render/Render env so no future command can reach it.

Nothing in this repository deletes or modifies the legacy database.

## Environment reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | Legacy Render source (read-only) |
| `NEON_DATABASE_URL` | — | Neon destination |
| `LEGACY_TRANSFER_COMMIT` | `false` | Second switch required for a real migration |
| `LEGACY_TRANSFER_BATCH_SIZE` | `300` | Rows per verification batch (1–2000) |
| `LEGACY_TRANSFER_TABLES` | all | Comma-separated subset to transfer |
| `LEGACY_TRANSFER_IGNORE_TABLES` | — | Legacy-only tables to skip deliberately |
| `LEGACY_TRANSFER_ALLOW_UNSUPPORTED_TABLES` | `false` | Skip unknown legacy tables instead of blocking |
| `LEGACY_TRANSFER_ADD_MISSING_COLUMNS` | `false` | Create missing legacy columns on Neon in-transaction |
| `LEGACY_TRANSFER_REPAIR_DUPLICATES` | `false` | Suffix duplicate unique values instead of blocking |
| `LEGACY_TRANSFER_CONFLICT` | `abort` | `abort`, `skip` or `replace` for existing primary keys |
| `LEGACY_TRANSFER_APPLY_SCHEMA` | `false` | Apply `db/migrations/*.sql` to Neon first (or pass `--apply-schema`) |
| `LEGACY_TRANSFER_REPORT` | timestamped | Report path; `LEGACY_TRANSFER_REPORT_DISABLED=true` turns it off |

## Tests

```sh
npm test                 # unit tests, no database needed
npm run test:transfer    # end-to-end against two real PostgreSQL databases
```

The integration suite creates scratch databases and covers: empty target, legacy-only
tables, column drift, duplicate repair, the two-key commit guard, source/target
collision, a full verified migration (microsecond timestamps and NULLs preserved),
idempotent re-runs, divergent-row protection and the PostgreSQL-level read-only guard.
Set `LEGACY_TEST_DATABASE_URL` and `NEON_TEST_DATABASE_URL` to enable it; without them
the suite skips.
