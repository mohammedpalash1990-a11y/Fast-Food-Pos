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

Seed admin credentials come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. Never commit `.env`; disable/delete the seeded account and provision real users before exposing this service. JWT signing key must be at least 32 characters. Use HTTPS, a strong database password, backups, and a secret manager in deployment.

## Legacy Render-to-Neon data transfer

For a controlled legacy transfer, keep the old Render database URL in `DATABASE_URL` and set the Neon destination URL in `NEON_DATABASE_URL`. The API pool uses Neon when `NEON_DATABASE_URL` is present; the migration reads the old database through `DATABASE_URL`.

The transfer is **dry-run by default**. Run `npm run db:migrate` and review the per-table verification output first. The source connection is read-only, the destination transfer transaction is rolled back, and no legacy rows are committed during this check. The migration stops on unsupported source tables, incompatible primary keys/columns, or unique-key conflicts. Matching primary-key rows are synchronized and verified column-by-column, including NULL values.

Only after reviewing a successful dry run and confirming a backup/recovery path should the operator explicitly set `LEGACY_TRANSFER_COMMIT=true` and run the migration again. Do not delete or overwrite the legacy Render database. Keep the two connection strings separate; never replace the source `DATABASE_URL` with the Neon URL during the transfer.

## Backend endpoints delivered

- `POST /api/auth/login`, `GET /api/auth/me`: bcrypt password verification, short-lived JWT, active-user reload, login rate limiting.
- `GET /api/inventory`, `POST/PATCH /api/inventory`: role-checked ingredient listing/editing.
- `POST /api/purchases`: transactional supplier invoice, stock receiving, stock movement and initial payment.
- `GET /api/suppliers`, `POST /api/suppliers/:id/payments`, `GET /api/payables`: supplier balances/payments.
- `POST /api/orders`: transactional order insertion and recipe stock deduction with stock row locks and negative-stock rejection.
- `GET /api/menu`, `GET /api/menu/qr`: public menu and generated PNG QR code (requires a public hosted menu URL and branch id).
- `GET /api/health`: database connectivity.

PostgreSQL schema supports organizations, branches, roles, users, products, categories, ingredient stock, recipes, customers, orders, payments, suppliers, purchases, stock movements and audit logs. The API scopes operational data by authenticated organization/branch and roles. Financial changes are transactionally recorded.

## Frontend status and limitations

The existing mobile-responsive admin UI and local demo workflows remain. The API is an initial backend foundation and is not yet fully connected to the React views: login UI/token lifecycle, inventory edit forms, purchase/payment UI, remote menu/order fetching, and database-to-dashboard reporting still need integration. The generated QR endpoint returns an actual PNG but needs deployment URL configuration; the customer ordering page itself is not yet built. No live payment gateway is configured. This is not yet production-ready: run typechecks, integration/security tests, create migrations/backups policy, and review the API before handling real financial data.

## Useful commands

```sh
npm run build
npm run typecheck:server
npm run db:migrate
npm run db:seed
npm run api:dev
```
