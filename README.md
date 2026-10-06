# Soycraft B2B Ops

The internal wholesale back office for **Soycraft**, a Singapore pet-gear brand: from a retailer's order through delivery, invoicing, consignment sell-through, supplier orders and the monthly P&L, in one Next.js app.

> **Portfolio copy.** This is a cleaned snapshot of a private production repo. All retailer, staff and contact data here is fictional sample data, and access passwords are demo placeholders.

## What it does

| Area | Highlights |
|---|---|
| **Retailers & outlets** | Retailer accounts with multiple outlets, short codes, per-retailer pricing and consignment vs. outright terms |
| **Delivery orders** | Draft → confirmed → delivered workflow, with inventory deducted on delivery |
| **Invoices** | Generated from delivery orders or ad-hoc lines, partial payments and amount-paid tracking |
| **Consignment sell-through** | Per-outlet sell-through reports that turn consigned stock into billable sales |
| **Inventory** | Live stock levels with manual adjustments and an audit trail |
| **Suppliers & supplier orders** | Purchase orders with adjustments, other line items and payment status |
| **Finance** | Income and expense entries by category, plus a P&L view (admin-only) |
| **Reports & export** | Sales and stock reports, data export, CSV product import |
| **Roles** | Admin and staff roles, with finance routes locked to admins in middleware |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 6 + PostgreSQL · Auth.js · Tailwind + shadcn/ui · Vercel

## Run it locally

```bash
npm install
cp .env.example .env            # set DATABASE_URL and DIRECT_URL
npx prisma migrate deploy
SEED_PASSWORD=choose-one npx tsx prisma/seed.ts
npx tsx prisma/seed-sample.ts   # optional: fictional retailers, products and orders
npm run dev
```

The access gate accepts `demo-admin` or `demo-staff`.

## Notes

- 15 incremental Prisma migrations show how the schema grew with the business (outlets, consignment, supplier orders, partial payments, performance indexes).
- Built and maintained by [Isaac Ho](https://github.com/isaacsplash18).
