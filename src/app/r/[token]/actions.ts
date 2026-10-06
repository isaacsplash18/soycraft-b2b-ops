"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

export async function getRetailerByToken(token: string) {
  if (!token) return null;

  return prisma.retailer.findUnique({
    where: { magicToken: token },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      isActive: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Retailer inventory (current consignment stock)
// ---------------------------------------------------------------------------

export async function getRetailerInventory(retailerId: string) {
  // Aggregate inventory ledger to get current stock per product at this retailer
  const ledgerEntries = await prisma.inventoryLedger.groupBy({
    by: ["productId"],
    where: { retailerId },
    _sum: { quantityChange: true },
  });

  // Filter to products with positive stock
  const productIds = ledgerEntries
    .filter((e) => (e._sum.quantityChange ?? 0) > 0)
    .map((e) => ({ id: e.productId, stock: e._sum.quantityChange ?? 0 }));

  if (productIds.length === 0) return [];

  // Fetch product details
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds.map((p) => p.id) },
      isActive: true,
    },
    select: {
      id: true,
      skuCode: true,
      name: true,
    },
    orderBy: { skuCode: "asc" },
  });

  // Fetch current pricing for this retailer
  const pricing = await prisma.retailerPricing.findMany({
    where: {
      retailerId,
      effectiveTo: null,
    },
    select: {
      productId: true,
      unitPrice: true,
    },
  });

  const priceMap = new Map(
    pricing.map((p) => [p.productId, Number(p.unitPrice)])
  );
  const stockMap = new Map(productIds.map((p) => [p.id, p.stock]));

  return products.map((product) => ({
    productId: product.id,
    skuCode: product.skuCode,
    name: product.name,
    currentStock: stockMap.get(product.id) ?? 0,
    unitPrice: priceMap.get(product.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Submit sell-through report
// ---------------------------------------------------------------------------

export async function submitSellThrough(
  retailerId: string,
  month: string, // "YYYY-MM"
  items: { productId: string; quantitySold: number }[]
) {
  // Validate items
  const validItems = items.filter((i) => i.quantitySold > 0);
  if (validItems.length === 0) {
    return { success: false, error: "No items with sold quantities" };
  }

  // Parse month
  const [year, mon] = month.split("-").map(Number);
  const reportingMonth = new Date(year, mon - 1, 1);

  // Get current inventory to validate quantities
  const inventory = await getRetailerInventory(retailerId);
  const stockMap = new Map(inventory.map((i) => [i.productId, i.currentStock]));
  const priceMap = new Map(inventory.map((i) => [i.productId, i.unitPrice]));

  for (const item of validItems) {
    const stock = stockMap.get(item.productId) ?? 0;
    if (item.quantitySold > stock) {
      return {
        success: false,
        error: `Units sold exceeds current stock for one or more products`,
      };
    }
  }

  try {
    // Check if a report already exists for this retailer/month
    const existing = await prisma.sellThroughReport.findFirst({
      where: {
        retailerId,
        reportingMonth,
      },
    });

    if (existing && (existing.status === "APPROVED" || existing.status === "INVOICED")) {
      return {
        success: false,
        error: "A report for this month has already been approved",
      };
    }

    // Build line items with snapshotted prices
    const lineItemsData = validItems.map((item) => {
      const unitPrice = priceMap.get(item.productId) ?? 0;
      const lineTotal = Number((item.quantitySold * unitPrice).toFixed(2));
      return {
        productId: item.productId,
        quantitySold: item.quantitySold,
        unitPrice,
        lineTotal,
      };
    });

    if (existing) {
      // Update existing DRAFT/SUBMITTED report
      await prisma.$transaction(async (tx) => {
        // Delete old line items
        await tx.sellThroughLineItem.deleteMany({
          where: { reportId: existing.id },
        });

        // Update report and add new line items
        await tx.sellThroughReport.update({
          where: { id: existing.id },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            lineItems: {
              create: lineItemsData,
            },
          },
        });
      });
    } else {
      // Create new report
      await prisma.sellThroughReport.create({
        data: {
          retailerId,
          reportingMonth,
          status: "SUBMITTED",
          submittedAt: new Date(),
          lineItems: {
            create: lineItemsData,
          },
        },
      });
    }

    revalidatePath(`/r/`);
    return { success: true };
  } catch (err) {
    console.error("Failed to submit sell-through report:", err);
    return { success: false, error: errorMessage(err, "Failed to submit report") };
  }
}

// ---------------------------------------------------------------------------
// Report history for retailer
// ---------------------------------------------------------------------------

export async function getRetailerReportHistory(retailerId: string) {
  return prisma.sellThroughReport.findMany({
    where: { retailerId },
    include: {
      lineItems: true,
    },
    orderBy: { reportingMonth: "desc" },
  });
}
