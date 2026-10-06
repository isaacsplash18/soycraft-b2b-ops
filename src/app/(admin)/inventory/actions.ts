"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_cache } from "next/cache";
import { getCurrentUser } from "@/lib/auth-utils";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { z } from "zod";
import { errorMessage } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUser() {
  const user = await getCurrentUser();
  return user?.id ?? "admin";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export type WarehouseStockItem = {
  productId: string;
  productName: string;
  skuCode: string;
  currentStock: number;
};

export type RetailerStockItem = {
  productId: string;
  productName: string;
  skuCode: string;
  retailerId: string;
  retailerName: string;
  outletId: string | null;
  outletName: string | null;
  quantity: number;
};

export type LedgerEntry = {
  id: string;
  productId: string;
  productName: string;
  skuCode: string;
  retailerId: string | null;
  retailerName: string | null;
  quantityChange: number;
  movementType: string;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
};

export type LedgerFilters = {
  productId?: string;
  retailerId?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getWarehouseStock(): Promise<WarehouseStockItem[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      skuCode: true,
    },
    orderBy: { name: "asc" },
  });

  const ledgerAgg = await prisma.inventoryLedger.groupBy({
    by: ["productId"],
    where: { retailerId: null },
    _sum: { quantityChange: true },
  });

  const stockMap = new Map<string, number>(
    ledgerAgg.map((row: { productId: string; _sum: { quantityChange: number | null } }) => [
      row.productId,
      row._sum.quantityChange ?? 0,
    ])
  );

  const items: WarehouseStockItem[] = products.map(
    (p: { id: string; name: string; skuCode: string }) => {
      const currentStock = stockMap.get(p.id) ?? 0;
      return {
        productId: p.id,
        productName: p.name,
        skuCode: p.skuCode,
        currentStock,
      };
    }
  );

  // Sort by product name
  items.sort((a: WarehouseStockItem, b: WarehouseStockItem) =>
    a.productName.localeCompare(b.productName)
  );

  return items;
}

export async function getRetailerStock(
  retailerId?: string
): Promise<RetailerStockItem[]> {
  const where: Record<string, unknown> = {
    retailerId: { not: null },
  };

  if (retailerId) {
    where.retailerId = retailerId;
  }

  const ledgerAgg = await prisma.inventoryLedger.groupBy({
    by: ["productId", "retailerId", "outletId"],
    where,
    _sum: { quantityChange: true },
  });

  if (ledgerAgg.length === 0) return [];

  const productIds = [
    ...new Set(
      ledgerAgg.map(
        (r: { productId: string }) => r.productId
      )
    ),
  ];
  const retailerIds = [
    ...new Set(
      ledgerAgg
        .map((r: { retailerId: string | null }) => r.retailerId)
        .filter((id: string | null): id is string => id !== null)
    ),
  ];
  const outletIds = [
    ...new Set(
      ledgerAgg
        .map((r: { outletId: string | null }) => r.outletId)
        .filter((id: string | null): id is string => id !== null)
    ),
  ];

  const [products, retailers, outlets] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, skuCode: true },
    }),
    prisma.retailer.findMany({
      where: { id: { in: retailerIds } },
      select: { id: true, name: true },
    }),
    outletIds.length > 0
      ? prisma.outlet.findMany({
          where: { id: { in: outletIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map(
    products.map((p: { id: string; name: string; skuCode: string }) => [p.id, p])
  );
  const retailerMap = new Map(
    retailers.map((r: { id: string; name: string }) => [r.id, r])
  );
  const outletMap = new Map(
    outlets.map((o: { id: string; name: string }) => [o.id, o])
  );

  const results: RetailerStockItem[] = [];
  for (const row of ledgerAgg) {
    const product = productMap.get(row.productId);
    const retailer = row.retailerId ? retailerMap.get(row.retailerId) : null;
    if (!product || !retailer) continue;
    const outlet = row.outletId ? outletMap.get(row.outletId) : null;
    results.push({
      productId: row.productId,
      productName: product.name,
      skuCode: product.skuCode,
      retailerId: retailer.id,
      retailerName: retailer.name,
      outletId: outlet?.id ?? null,
      outletName: outlet?.name ?? null,
      quantity: row._sum.quantityChange ?? 0,
    });
  }

  results.sort((a: RetailerStockItem, b: RetailerStockItem) => {
    const rCmp = a.retailerName.localeCompare(b.retailerName);
    if (rCmp !== 0) return rCmp;
    const oCmp = (a.outletName ?? "").localeCompare(b.outletName ?? "");
    if (oCmp !== 0) return oCmp;
    return a.productName.localeCompare(b.productName);
  });

  return results;
}

export async function getLedgerEntries(filters?: LedgerFilters): Promise<{
  entries: LedgerEntry[];
  total: number;
}> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  if (filters?.productId) {
    where.productId = filters.productId;
  }

  if (filters?.retailerId) {
    if (filters.retailerId === "WAREHOUSE") {
      where.retailerId = null;
    } else {
      where.retailerId = filters.retailerId;
    }
  }

  if (filters?.movementType) {
    where.movementType = filters.movementType;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) {
      createdAt.gte = new Date(filters.dateFrom);
    }
    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }

  const [rawEntries, total] = await Promise.all([
    prisma.inventoryLedger.findMany({
      where,
      include: {
        product: { select: { name: true, skuCode: true } },
        retailer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.inventoryLedger.count({ where }),
  ]);

  const entries: LedgerEntry[] = rawEntries.map(
    (e: {
      id: string;
      productId: string;
      retailerId: string | null;
      quantityChange: number;
      movementType: string;
      referenceType: string | null;
      referenceId: string | null;
      notes: string | null;
      createdAt: Date;
      product: { name: string; skuCode: string };
      retailer: { name: string } | null;
    }) => ({
      id: e.id,
      productId: e.productId,
      productName: e.product.name,
      skuCode: e.product.skuCode,
      retailerId: e.retailerId,
      retailerName: e.retailer?.name ?? null,
      quantityChange: e.quantityChange,
      movementType: e.movementType,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      notes: e.notes,
      createdAt: e.createdAt,
    })
  );

  return { entries, total };
}

// ---------------------------------------------------------------------------
// Current stock for a single product + location
// ---------------------------------------------------------------------------

export async function getCurrentStock(
  productId: string,
  retailerId: string | null,
  outletId: string | null = null
): Promise<number> {
  const result = await prisma.inventoryLedger.aggregate({
    where: {
      productId,
      retailerId: retailerId ?? null,
      outletId: outletId ?? null,
    },
    _sum: { quantityChange: true },
  });

  return result._sum.quantityChange ?? 0;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const adjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  retailerId: z.string().nullable(),
  outletId: z.string().nullable().optional(),
  quantityChange: z.coerce.number().int().refine((n) => n !== 0, {
    message: "Quantity change cannot be zero",
  }),
  movementType: z.enum([
    "RESTOCK",
    "DAMAGE_WRITEOFF",
    "ADJUSTMENT",
    "RETURN_TO_SOYCRAFT",
  ]),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

export async function createAdjustment(
  data: AdjustmentInput
): Promise<ActionResult> {
  const parsed = adjustmentSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const userId = await requireUser();
  const { productId, retailerId, outletId, quantityChange, movementType, notes } =
    parsed.data;

  try {
    if (movementType === "RETURN_TO_SOYCRAFT") {
      if (!retailerId) {
        return {
          success: false,
          error: "A retailer must be selected for Return to Soycraft",
        };
      }

      const absQty = Math.abs(quantityChange);
      await prisma.$transaction(async (tx) => {
        await tx.inventoryLedger.create({
          data: {
            productId,
            retailerId,
            outletId: outletId || null,
            quantityChange: -absQty,
            movementType: "RETURN_TO_SOYCRAFT",
            referenceType: "manual_adjustment",
            notes,
            createdById: userId,
          },
        });

        await tx.inventoryLedger.create({
          data: {
            productId,
            retailerId: null,
            outletId: null,
            quantityChange: absQty,
            movementType: "RETURN_TO_SOYCRAFT",
            referenceType: "manual_adjustment",
            notes,
            createdById: userId,
          },
        });
      });
    } else {
      await prisma.inventoryLedger.create({
        data: {
          productId,
          retailerId: retailerId || null,
          outletId: outletId || null,
          quantityChange,
          movementType,
          referenceType: "manual_adjustment",
          notes,
          createdById: userId,
        },
      });
    }

    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("Failed to create adjustment:", err);
    return { success: false, error: errorMessage(err, "Failed to record adjustment") };
  }
}

// ---------------------------------------------------------------------------
// Dropdowns
// ---------------------------------------------------------------------------

const _getActiveProducts = unstable_cache(
  async () =>
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, skuCode: true },
      orderBy: { skuCode: "asc" },
    }),
  ["getActiveProducts", "inventory"],
  { tags: [CACHE_TAGS.activeProducts], revalidate: 300 },
);

export async function getActiveProducts() {
  return _getActiveProducts();
}

const _getActiveRetailers = unstable_cache(
  async () =>
    prisma.retailer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        outlets: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ["getActiveRetailers", "inventory"],
  { tags: [CACHE_TAGS.activeRetailers], revalidate: 300 },
);

export async function getActiveRetailers() {
  return _getActiveRetailers();
}
