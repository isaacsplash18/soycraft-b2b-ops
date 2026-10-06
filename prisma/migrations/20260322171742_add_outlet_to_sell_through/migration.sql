-- AlterTable
ALTER TABLE "outlets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sell_through_reports" ADD COLUMN     "outlet_id" TEXT;

-- AddForeignKey
ALTER TABLE "sell_through_reports" ADD CONSTRAINT "sell_through_reports_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
