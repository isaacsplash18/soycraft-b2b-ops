-- Add code column with default, then update existing rows
ALTER TABLE "retailers" ADD COLUMN "code" TEXT NOT NULL DEFAULT '';

-- Set codes for existing retailers
UPDATE "retailers" SET "code" = 'PAWS' WHERE "name" LIKE '%Pawsome%';
UPDATE "retailers" SET "code" = 'TPS' WHERE "name" LIKE '%Tail Trails%';
UPDATE "retailers" SET "code" = 'NEKO' WHERE "name" LIKE '%Whisker Lodge%';
UPDATE "retailers" SET "code" = 'PLC' WHERE "name" LIKE '%Happy Paws%';
UPDATE "retailers" SET "code" = 'FKB' WHERE "name" LIKE '%Fur Kids%';

-- Remove default and add unique constraint
ALTER TABLE "retailers" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_code_key" UNIQUE ("code");

-- Create outlets table
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "retailer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "contact_person" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outlets_retailer_id_code_key" UNIQUE ("retailer_id", "code"),
    CONSTRAINT "outlets_retailer_id_fkey" FOREIGN KEY ("retailer_id") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add outlet_id to delivery_orders
ALTER TABLE "delivery_orders" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add outlet_id to inventory_ledger
ALTER TABLE "inventory_ledger" ADD COLUMN "outlet_id" TEXT;
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
