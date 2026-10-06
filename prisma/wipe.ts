import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.supplierOrderAdjustment.deleteMany(),
    prisma.financeEntry.deleteMany(),
    prisma.supplierOrderLineItem.deleteMany(),
    prisma.supplierOrder.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.otherSubCategory.deleteMany(),
    prisma.invoiceLineItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.sellThroughLineItem.deleteMany(),
    prisma.sellThroughReport.deleteMany(),
    prisma.inventoryLedger.deleteMany(),
    prisma.deliveryOrderLineItem.deleteMany(),
    prisma.deliveryOrder.deleteMany(),
    prisma.retailerPricing.deleteMany(),
    prisma.outlet.deleteMany(),
    prisma.retailer.deleteMany(),
    prisma.product.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  console.log("Wiped all business data. Users + settings preserved.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
