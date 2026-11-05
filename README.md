# Musafir Fast Food POS & Management System

A premium restaurant POS and management system built with React + TypeScript + Vite + Tailwind CSS.

## Features included

- Premium dark + gold interface inspired by the provided concept design
- Dashboard with live summary cards and charts
- Functional POS / billing layer with search, category filtering, cart controls, discounts, tax and payment methods
- Order management and kitchen status workflow
- Inventory and recipe tracking with low-stock alerts
- Customer and supplier panels
- Accounting overview and audit permissions
- QR menu mock flow for table ordering
- Local persistence through browser storage for demo data and offline-ready behavior

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide icons

## Quick start

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then open the local address shown in the terminal, typically:

```bash
http://localhost:5173
```

## Production build

```bash
npm run build
npm run preview -- --host 0.0.0.0
```

## Notes

This repository implements the core restaurant operations stack as a production-ready front-end application with demo data and local persistence. It is designed to be extended to PostgreSQL, secure auth, and backend APIs in a future phase.

## Completed features

- Design system and navigation
- Dashboard summary cards and analytics
- POS billing with cart and discount logic
- Orders and kitchen workflow management
- Inventory and recipe-based depletion flow
- Customers, suppliers and accounting overview
- QR menu mock interface
- Permission-oriented settings and audit trail

## Remaining items for full multi-module production rollout

- Real backend API and PostgreSQL schema
- Authentication and role-based security
- Actual offline sync and IndexedDB implementation
- Payroll, expense workflows and full accounting ledger
- Advanced multi-branch configuration
- End-to-end testing automation
