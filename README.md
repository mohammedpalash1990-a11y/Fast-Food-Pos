# Musafir Fast Food POS

A complete restaurant point-of-sale and back-office console for **Musafir Fast Food** — React + TypeScript + Vite front end with an **Express + SQLite** backend (Node's built-in `node:sqlite`). Every screen writes to the database; there are no static placeholder modules.

![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![stack](https://img.shields.io/badge/Express-4-000000) ![stack](https://img.shields.io/badge/SQLite-node%3Asqlite-044a64)

## Quick start

Requires **Node.js 22.5+** (uses the built-in `node:sqlite` module).

```sh
npm install
npm run db:migrate     # create the SQLite schema at data/pos.db
npm run db:seed        # load the demo branch, menu, orders and staff
npm run api            # API on http://localhost:3001
npm run dev            # Vite console on http://localhost:5173
```

`npm run dev` proxies `/api` to the API server, so open **http://localhost:5173**.

### Seeded logins

| Email | Role | Password |
| --- | --- | --- |
| `admin@musafir.local` | owner | `Musafir@2026!` |
| `manager@musafir.local` | manager | `Musafir@2026!` |
| `cashier@musafir.local` | cashier | `Musafir@2026!` |
| `kitchen@musafir.local` | kitchen | `Musafir@2026!` |
| `inventory@musafir.local` | inventory | `Musafir@2026!` |
| `accounts@musafir.local` | accountant | `Musafir@2026!` |

Override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before the first seed, and set a strong `JWT_SECRET` (32+ chars) in `.env`. Copy `.env.example` to get started.

## Modules (all connected to the API)

- **Workspace** — Dashboard, POS/Billing, Orders, Kitchen Display, Tables Management, Reservations
- **Restaurant** — Customers, Menu Management, Categories, Inventory, Recipes & Ingredients, Suppliers, Purchase Management, Delivery Management
- **Finance & team** — Expenses, Employees, Attendance, Salary & Payroll, Accounting ledger, Sales Reports, Profit & Loss, Customer Due, Discounts & Coupons
- **Channels & setup** — QR Menu (PNG per table + public guest menu at `/menu`), Settings, User Roles & Permissions

### What actually happens when you use it

- **POS** builds a ticket with table/customer/coupon/notes, validates coupon minimums, computes VAT and delivery fee, then on charge it: creates the order, **deducts ingredient stock via the product recipe**, logs stock movements, marks the table occupied, accrues customer due + loyalty points, increments coupon usage and posts a payment entry.
- **Orders** advances the status lifecycle and settles balances (posting a due-collection payment).
- **Purchases** receives an invoice, increases ingredient stock, records movements, updates supplier payable and posts the outgoing payment.
- **Payroll** generates monthly records from the staff directory and pays them, clearing advances and posting payroll to the ledger.
- **Inventory** movements, **expenses**, **supplier payments** and **customer due collections** all feed the **Accounting** ledger and **Profit & Loss** (COGS from recipe cost).

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | DB connectivity probe |
| POST | `/api/auth/login` | bcrypt + JWT (rate limited) |
| GET | `/api/auth/me` | Validate bearer token |
| GET | `/api/bootstrap` | Full branch snapshot for the console |
| POST | `/api/sync` | Transactional write-back of the console state |
| GET | `/api/menu` | Public menu JSON |
| GET | `/api/menu/qr?table=T-01` | PNG QR code for a table |
| GET | `/api/inventory` / `/api/suppliers` / `/api/receivables` / `/api/payables` | Read-only reporting slices |

Data lives in `data/pos.db` (ignored by git). Delete that file and re-run `npm run db:seed` for a clean demo.

## Scripts

```sh
npm run dev              # Vite dev server (0.0.0.0:5173)
npm run build            # tsc project build + production bundle
npm run api              # Express API (0.0.0.0:3001)
npm run api:dev          # API with watch reload
npm run db:migrate       # apply SQLite schema
npm run db:seed          # seed demo data
npm run typecheck:server # type-check the API project
```

## Notes

- Offline resilience: if the API is unreachable the console keeps working against a local snapshot and retries the sync when the server returns.
- Authentication uses bearer JWTs from `/api/auth/login`; the login screen also offers an offline preview mode for local demos.
- This is a demo build — put it behind HTTPS, rotate the seeded passwords and secrets, and add backups before using it for real money.
