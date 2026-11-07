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

Local demo credentials come from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. For Render production, set `NEON_DATABASE_URL`, `JWT_SECRET` (at least 32 random characters), `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` (12–128 characters). Optional `BOOTSTRAP_RESTAURANT_NAME` and `BOOTSTRAP_BRANCH_NAME` customize the first organization and branch. The production seed creates only the first owner and branch; it does not insert demo products or sample transactions. The bootstrap is idempotent and does not reset an existing owner's password. Never commit `.env` or put credentials in source control. Use HTTPS, database backups, and a secret manager. For legacy Render-to-Neon transfer, keep the old Render connection in `DATABASE_URL` and the Neon destination in `NEON_DATABASE_URL`. Startup applies both PostgreSQL schema migrations to Neon first. Transfer is a dry run by default (`LEGACY_TRANSFER_COMMIT=false`): the source is read-only, the Neon transaction is rolled back, and every supported source row is checked for exact column equality (including NULL values) before the dry run passes. Unsupported tables, missing columns/tables, primary-key mismatches, or conflicting unique keys stop the transfer. Only set `LEGACY_TRANSFER_COMMIT=true` after a successful reviewed dry run and a verified backup/recovery plan. Never delete or overwrite the old Render database until the transfer has been independently verified.

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
npm run db:migrate
npm run db:seed
npm run api:dev
```
