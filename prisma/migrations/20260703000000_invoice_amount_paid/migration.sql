-- Partial-payment tracking on invoices. Additive; existing rows default to 0.
-- Invoices already marked PAID are backfilled to their total so the
-- outstanding amount reads as zero.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "invoices" SET "amount_paid" = "total" WHERE "status" = 'PAID';
