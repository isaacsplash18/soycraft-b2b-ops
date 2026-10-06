-- CreateEnum
CREATE TYPE "SOPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterTable
ALTER TABLE "supplier_orders" ADD COLUMN     "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" "SOPaymentStatus" NOT NULL DEFAULT 'UNPAID';
