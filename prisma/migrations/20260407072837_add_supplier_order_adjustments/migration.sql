-- CreateTable
CREATE TABLE "supplier_order_adjustments" (
    "id" TEXT NOT NULL,
    "supplier_order_id" TEXT NOT NULL,
    "line_item_id" TEXT,
    "product_sku" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "qty_before" INTEGER NOT NULL,
    "qty_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_order_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_order_adjustments_supplier_order_id_idx" ON "supplier_order_adjustments"("supplier_order_id");

-- AddForeignKey
ALTER TABLE "supplier_order_adjustments" ADD CONSTRAINT "supplier_order_adjustments_supplier_order_id_fkey" FOREIGN KEY ("supplier_order_id") REFERENCES "supplier_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
