# Musafir Fast Food POS

A restaurant operations demo built with React, TypeScript, Vite, Tailwind CSS, and local browser persistence. Visual design follows the charcoal-and-gold Musafir reference.

## Run locally

```sh
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). To create a production bundle, run `npm run build`.

## Current working demo

- Responsive charcoal-and-gold admin shell with all 26 requested navigation modules listed.
- Dashboard sales totals, daily order count, and best sellers derived from browser-stored order records.
- POS menu search and category filters, order types, cart quantity controls, tax/discount calculation, payment methods, hold/resume, and browser print.
- Orders and kitchen status workflow.
- Inventory list and manual receive-stock operation.
- Customer list and add-customer flow.
- QR menu preview and supplier/accounting snapshots.
- LocalStorage persistence for demo state.

## Module status

The complete navigation list is present. Modules not yet implemented are explicitly identified in their screens; they are not represented as finished workflows. Remaining work includes server-side API and PostgreSQL, secure authentication/role enforcement, durable offline sync, complete recipe/ingredient mapping, purchase/expense/payroll ledgers, customer due collection, reservations/tables, actual QR generation/online ordering, and automated end-to-end tests.

## Important limitations

This is a single-browser demo, not a production-ready financial system. LocalStorage is not a shared database, authentication is not configured, and the demo does not safely support concurrent terminals. Do not rely on it as the sole record for real payments or inventory until a secure backend and transaction-safe database are integrated. Accurate profit reporting also requires recorded COGS, purchases, expenses and payroll; the app deliberately avoids fabricated profit figures.
