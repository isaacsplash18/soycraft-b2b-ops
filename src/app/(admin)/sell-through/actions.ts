"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { errorMessage } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUser() {
  const user = await getCurrentUser();
  return user?.id ?? "admin";
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getSellThroughReports(filters?: {
  status?: string;
  retailerId?: string;
  month?: string; // ISO date string e.g. "2026-03"
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.retailerId) {
    where.retailerId = filters.retailerId;
  }

  if (filters?.month) {
    // month comes as "YYYY-MM", we match the reportingMonth date
    const [year, mon] = filters.month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    where.reportingMonth = { gte: start, lt: end };
  }

  const reports = await prisma.sellThroughReport.findMany({
    where,
    include: {
      retailer: { select: { id: true, name: true } },
      outlet: { select: { id: true, name: true } },
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return reports.map((r) => ({
    ...r,
    total: r.lineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0),
  }));
}

export async function getSellThroughReport(id: string) {
  return prisma.sellThroughReport.findUnique({
    where: { id },
    include: {
      retailer: { select: { id: true, name: true, code: true } },
      outlet: { select: { id: true, name: true, code: true } },
      approvedBy: { select: { name: true } },
      lineItems: {
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
        },
        orderBy: { product: { skuCode: "asc" } },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Create Sell-Through (Admin entry)
// ---------------------------------------------------------------------------

export type CreateSellThroughInput = {
  retailerId: string;
  outletId?: string;
  reportingMonth: string; // "YYYY-MM-DD" or "YYYY-MM"
  status: "DRAFT" | "APPROVED";
  lineItems: {
    productId: string;
    quantitySold: number;
    unitPrice: number;
  }[];
};

export async function createSellThrough(data: CreateSellThroughInput) {
  const userId = await requireUser();

  if (!data.retailerId) {
    return { success: false, error: "Retailer is required" };
  }
  if (!data.lineItems || data.lineItems.length === 0) {
    return { success: false, error: "At least one line item is required" };
  }

  // Parse reporting month
  let reportingMonth: Date;
  if (data.reportingMonth.length === 7) {
    // "YYYY-MM" format
    const [year, mon] = data.reportingMonth.split("-").map(Number);
    reportingMonth = new Date(year, mon - 1, 1);
  } else {
    reportingMonth = new Date(data.reportingMonth);
  }

  const lineItemsData = data.lineItems.map((li) => ({
    productId: li.productId,
    quantitySold: li.quantitySold,
    unitPrice: li.unitPrice,
    lineTotal: Number((li.quantitySold * li.unitPrice).toFixed(2)),
  }));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.sellThroughReport.create({
        data: {
          retailerId: data.retailerId,
          outletId: data.outletId || null,
          reportingMonth,
          status: data.status,
          submittedAt: data.status === "APPROVED" ? new Date() : null,
          approvedById: data.status === "APPROVED" ? userId : null,
          approvedAt: data.status === "APPROVED" ? new Date() : null,
          lineItems: {
            create: lineItemsData,
          },
        },
      });

      // If confirming directly, create inventory ledger entries
      if (data.status === "APPROVED") {
        const retailer = await tx.retailer.findUnique({
          where: { id: data.retailerId },
          select: { name: true },
        });

        for (const item of lineItemsData) {
          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              retailerId: data.retailerId,
              outletId: data.outletId || null,
              quantityChange: -item.quantitySold,
              movementType: "SELL_THROUGH",
              referenceType: "sell_through_report",
              referenceId: report.id,
              notes: `Sell-through: ${item.quantitySold} units sold at ${retailer?.name ?? "retailer"}`,
              createdById: userId,
            },
          });
        }
      }

      return report;
    });

    revalidatePath("/sell-through");
    revalidatePath("/dashboard");
    return { success: true, reportId: result.id };
  } catch (err) {
    console.error("Failed to create sell-through report:", err);
    return { success: false, error: errorMessage(err, "Failed to create sell-through report") };
  }
}

// ---------------------------------------------------------------------------
// Confirm Sell-Through (admin confirms a DRAFT report)
// ---------------------------------------------------------------------------

export async function confirmSellThroughReport(id: string) {
  const userId = await requireUser();

  const report = await prisma.sellThroughReport.findUnique({
    where: { id },
    include: {
      lineItems: true,
      retailer: { select: { name: true } },
    },
  });

  if (!report) return { success: false, error: "Report not found" };
  if (report.status !== "DRAFT" && report.status !== "SUBMITTED") {
    return { success: false, error: "Only DRAFT or SUBMITTED reports can be confirmed" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.sellThroughReport.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
          submittedAt: report.submittedAt ?? new Date(),
        },
      });

      // Create SELL_THROUGH inventory ledger entries for each line item
      for (const item of report.lineItems) {
        await tx.inventoryLedger.create({
          data: {
            productId: item.productId,
            retailerId: report.retailerId,
            outletId: report.outletId,
            quantityChange: -item.quantitySold,
            movementType: "SELL_THROUGH",
            referenceType: "sell_through_report",
            referenceId: report.id,
            notes: `Sell-through: ${item.quantitySold} units sold at ${report.retailer.name}`,
            createdById: userId,
          },
        });
      }
    });

    revalidatePath("/sell-through");
    revalidatePath(`/sell-through/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to confirm sell-through report:", err);
    return { success: false, error: errorMessage(err, "Failed to confirm report") };
  }
}

// ---------------------------------------------------------------------------
// Approve Sell-Through (retailer-submitted reports)
// ---------------------------------------------------------------------------

export async function approveSellThroughReport(id: string) {
  const userId = await requireUser();

  const report = await prisma.sellThroughReport.findUnique({
    where: { id },
    include: {
      lineItems: true,
      retailer: { select: { name: true } },
    },
  });

  if (!report) return { success: false, error: "Report not found" };
  if (report.status !== "SUBMITTED") {
    return { success: false, error: "Only SUBMITTED reports can be approved" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update report status
      await tx.sellThroughReport.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      // Create SELL_THROUGH inventory ledger entries for each line item
      for (const item of report.lineItems) {
        await tx.inventoryLedger.create({
          data: {
            productId: item.productId,
            retailerId: report.retailerId,
            outletId: report.outletId,
            quantityChange: -item.quantitySold,
            movementType: "SELL_THROUGH",
            referenceType: "sell_through_report",
            referenceId: report.id,
            notes: `Sell-through: ${item.quantitySold} units sold at ${report.retailer.name}`,
            createdById: userId,
          },
        });
      }
    });

    revalidatePath("/sell-through");
    revalidatePath(`/sell-through/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to approve sell-through report:", err);
    return { success: false, error: errorMessage(err, "Failed to approve report") };
  }
}

// ---------------------------------------------------------------------------
// Reject Sell-Through (retailer-submitted reports)
// ---------------------------------------------------------------------------

export async function rejectSellThroughReport(id: string, notes?: string) {
  await requireUser();
  void notes;

  const report = await prisma.sellThroughReport.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!report) return { success: false, error: "Report not found" };
  if (report.status !== "SUBMITTED") {
    return { success: false, error: "Only SUBMITTED reports can be rejected" };
  }

  try {
    await prisma.sellThroughReport.update({
      where: { id },
      data: {
        status: "DRAFT",
        submittedAt: null,
      },
    });

    revalidatePath("/sell-through");
    revalidatePath(`/sell-through/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to reject sell-through report:", err);
    return { success: false, error: errorMessage(err, "Failed to reject report") };
  }
}

// ---------------------------------------------------------------------------
// Retailer queries for the form
// ---------------------------------------------------------------------------

export async function getConsignmentRetailers() {
  return prisma.retailer.findMany({
    where: { isActive: true, type: "CONSIGNMENT" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getActiveRetailersWithOutlets() {
  return prisma.retailer.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      outlets: {
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getRetailerProductsForST(retailerId: string) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { skuCode: "asc" },
  });

  const prices = await prisma.retailerPricing.findMany({
    where: {
      retailerId,
      effectiveTo: null,
    },
  });

  const priceMap = new Map(
    prices.map((p: { productId: string; unitPrice: unknown }) => [
      p.productId,
      Number(p.unitPrice),
    ])
  );

  return products.map(
    (product: { id: string; skuCode: string; name: string; msrp: unknown }) => ({
      id: product.id,
      skuCode: product.skuCode,
      name: product.name,
      unitPrice: priceMap.get(product.id) ?? null,
    })
  );
}

export async function getRetailerOutletsForST(retailerId: string) {
  return prisma.outlet.findMany({
    where: { retailerId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}
