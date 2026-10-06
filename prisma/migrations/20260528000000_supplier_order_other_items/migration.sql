-- Allow supplier-order line items to be ad-hoc (packaging, freight, etc.)
-- in addition to catalog products. productId becomes nullable; a new
-- description column holds the free-text label for non-product lines.
--
-- Additive only — existing rows keep their productId set; description is null.
-- No data backfill needed.

ALTER TABLE "supplier_order_line_items"
  ALTER COLUMN "product_id" DROP NOT NULL;

ALTER TABLE "supplier_order_line_items"
  ADD COLUMN IF NOT EXISTS "description" TEXT;
