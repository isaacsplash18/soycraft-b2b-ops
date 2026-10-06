-- DropForeignKey
ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_product_id_fkey";

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "description" TEXT,
ALTER COLUMN "product_id" DROP NOT NULL,
ALTER COLUMN "reference_type" DROP NOT NULL,
ALTER COLUMN "reference_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "outlet_id" TEXT,
ALTER COLUMN "source_type" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
