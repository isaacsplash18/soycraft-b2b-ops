-- Performance indexes for hot list-page filter/sort columns.
--
-- IMPORTANT: This migration uses CREATE INDEX CONCURRENTLY, which cannot run
-- inside a transaction. Prisma wraps each migration file in a transaction by
-- default, so this file must be applied MANUALLY:
--
--   1. Paste the body of this file into the Supabase SQL editor and run it.
--   2. Then mark the migration applied so Prisma stops trying to run it:
--        npx prisma migrate resolve --applied 20260516120000_add_perf_indexes
--
-- IF NOT EXISTS keeps it idempotent — safe to re-run.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_status_idx"          ON "invoices"        ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_retailer_id_idx"     ON "invoices"        ("retailer_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_billing_month_idx"   ON "invoices"        ("billing_month");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoices_created_at_idx"      ON "invoices"        ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_orders_status_idx"       ON "delivery_orders" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_orders_retailer_id_idx"  ON "delivery_orders" ("retailer_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_orders_created_at_idx"   ON "delivery_orders" ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_orders_status_idx"           ON "supplier_orders" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_orders_supplier_id_idx"      ON "supplier_orders" ("supplier_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_orders_order_date_idx"       ON "supplier_orders" ("order_date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_orders_created_at_idx"       ON "supplier_orders" ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoice_line_items_invoice_id_idx"        ON "invoice_line_items"          ("invoice_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "invoice_line_items_product_id_idx"        ON "invoice_line_items"          ("product_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_order_line_items_do_id_idx"      ON "delivery_order_line_items"   ("delivery_order_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "delivery_order_line_items_product_id_idx" ON "delivery_order_line_items"   ("product_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_order_line_items_so_id_idx"      ON "supplier_order_line_items"   ("supplier_order_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "supplier_order_line_items_product_id_idx" ON "supplier_order_line_items"   ("product_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "inventory_ledger_product_id_idx"      ON "inventory_ledger" ("product_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inventory_ledger_retailer_id_idx"     ON "inventory_ledger" ("retailer_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inventory_ledger_outlet_id_idx"       ON "inventory_ledger" ("outlet_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "inventory_ledger_created_at_idx"      ON "inventory_ledger" ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "finance_entries_supplier_id_idx"          ON "finance_entries" ("supplier_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "finance_entries_supplier_order_id_idx"    ON "finance_entries" ("supplier_order_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "finance_entries_entry_date_idx"           ON "finance_entries" ("entry_date");
