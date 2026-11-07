# Musafir Fast Food POS

A premium responsive restaurant operations demo built with React, TypeScript, Vite, Tailwind CSS and PostgreSQL API scaffolding.

## Start the PostgreSQL database and API

Requirements: Node.js 20+, Docker Compose, and a private deployment environment.

```sh
cp .env.example .env
# Change JWT_SECRET and SEED_ADMIN_PASSWORD before starting anything.
# Set POSTGRES_PASSWORD to the same secure value as the password portion of DATABASE_URL.
docker compose up -d db
npm install
npm run db:migrate
npm run db:seed
npm run api:dev
```

In another terminal run `npm run dev`. Vite proxies `/api` requests to `http://localhost:3001`. Health check: `http://localhost:3001/api/health`.

Local demo credentials come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. For Render production, set `NEON_DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` (12–128 characters). Optional `BOOTSTRAP_RESTAURANT_NAME` and `BOOTSTRAP_BRANCH_NAME` customize the first organization and branch. The production seed creates only the first owner and branch; it does not insert demo products or sample transactions. The bootstrap is idempotent and does not reset an existing owner's password. Never commit `.env` or put credentials in source control. Use HTTPS, database backups, and a secret manager. Legacy data is moved with the guarded tooling described below — never delete or overwrite the old Render database until the transfer has been independently verified.

## Legacy Render → Neon PostgreSQL transfer

Production data lives in the old Render PostgreSQL database; the API writes to Neon.
`npm run db:transfer` moves it with verification, and **never modifies or deletes the
legacy database**.

```sh
# 1. schema only, on Neon (DATABASE_URL = legacy Render, NEON_DATABASE_URL = Neon)
npm run db:migrate

# 2. read-only dry run: prints a table plan, verifies every row, then rolls back
npm run db:transfer

# 3. only after explicit approval of the dry-run report
LEGACY_TRANSFER_COMMIT=true npm run db:transfer:commit
```

**Safety model**

- The source session runs `default_transaction_read_only = on` inside a
  `REPEATABLE READ READ ONLY` transaction, so PostgreSQL itself refuses any write.
- Exporting `LEGACY_TRANSFER_COMMIT=true` is not enough: `--commit` must be passed
  too. Without `--commit` the command is always a dry run that rolls back.
- Source and target are compared before connecting; the same database is refused.
- Schema drift, missing tables/columns, primary-key mismatches and duplicate
  conflicts are detected **before** copying and reported with a concrete remedy.
  Optional repairs (`LEGACY_TRANSFER_ADD_MISSING_COLUMNS`,
  `LEGACY_TRANSFER_REPAIR_DUPLICATES`) keep every legacy row instead of dropping data.
- Every copied row is re-read from Neon and compared column-by-column with
  `IS NOT DISTINCT FROM` (so NULLs and microsecond timestamps must match exactly),
  then row counts are reconciled per table.
- All writes to Neon — data and schema changes — happen in a single transaction.
  Any failure rolls everything back, so a partial migration is impossible.

Reports land in `reports/legacy-transfer-{dry-run,commit}-<timestamp>.json`
(git-ignored). Full blocker → remedy table and env reference:
[docs/legacy-transfer-runbook.md](docs/legacy-transfer-runbook.md).

Tests: `npm test` (unit rules, no database) and `npm run test:transfer`
(end-to-end against two real PostgreSQL databases via
`LEGACY_TEST_DATABASE_URL` / `NEON_TEST_DATABASE_URL`).

## Backend endpoints delivered

- `POST /api/auth/login`, `GET /api/auth/me`: bcrypt password verification, short-lived JWT, active-user reload, login rate limiting.
- `GET /api/inventory`, `POST/PATCH /api/inventory`: role-checked ingredient listing/editing.
- `POST /api/purchases`: transactional supplier invoice, stock receiving, stock movement and initial payment.
- `GET /api/suppliers`, `POST /api/suppliers/:id/payments`, `GET /api/payables`: supplier balances/payments.
- `POST /api/orders`: transactional order insertion and recipe stock deduction with stock row locks, negative-stock rejection, and organization-scoped customer validation.
- `GET /api/customers`, `POST /api/customers`: organization-scoped customer directory and audited customer creation; POS checkout can attach a saved customer to an order.
- `GET /api/menu`, `GET /api/menu/qr`: public menu and generated PNG QR code (requires a public hosted menu URL and branch id).
- `GET /api/health`: database connectivity.

PostgreSQL schema supports organizations, branches, roles, users, products, categories, ingredient stock, recipes, customers, orders, payments, suppliers, purchases, stock movements and audit logs. The API scopes operational data by authenticated organization/branch and roles. Financial changes are transactionally recorded.

## Frontend status and limitations

The existing mobile-responsive admin UI and local demo workflows remain. The API is an initial backend foundation and is not yet fully connected to the React views: login UI/token lifecycle, inventory edit forms, purchase/payment UI, remote menu/order fetching, and database-to-dashboard reporting still need integration. The generated QR endpoint returns an actual PNG but needs deployment URL configuration; the customer ordering page itself is not yet built. No live payment gateway is configured. This is not yet production-ready: run typechecks, integration/security tests, create migrations/backups policy, and review the API before handling real financial data.

## Useful commands

```sh
npm run build
npm run typecheck:server
npm run db:migrate           # schema only
npm run db:transfer          # legacy -> Neon dry run (read-only)
npm run db:seed
npm run api:dev
npm test                     # unit tests
npm run test:integration     # API + transfer integration tests (needs PostgreSQL)
```
