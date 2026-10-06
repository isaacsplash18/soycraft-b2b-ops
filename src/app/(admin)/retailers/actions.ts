"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { errorMessage } from "@/lib/action-utils";

function bustRetailerCache() {
  revalidateTag(CACHE_TAGS.activeRetailers, "max");
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const retailerInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Retailer code is required")
    .max(10, "Max 10 characters")
    .transform((v) => v.toUpperCase()),
  contactPerson: z.string().optional(),
  email: z.string().email("Must be a valid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["BUYOUT", "CONSIGNMENT"]),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

const outletInputSchema = z.object({
  retailerId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Outlet code is required")
    .max(5, "Max 5 characters")
    .transform((v) => v.toUpperCase()),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
});

export type OutletInput = z.infer<typeof outletInputSchema>;

export type RetailerInput = z.infer<typeof retailerInputSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  retailerId?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getRetailers(search?: string, type?: string) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { contactPerson: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type && (type === "BUYOUT" || type === "CONSIGNMENT")) {
    where.type = type;
  }

  return prisma.retailer.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRetailer(id: string) {
  // Pricing is not read off this record — the detail page loads it separately
  // through getRetailerPricing — so it is not joined in here.
  return prisma.retailer.findUnique({
    where: { id },
    include: {
      outlets: { orderBy: { name: "asc" } },
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createRetailer(
  data: RetailerInput
): Promise<ActionResult> {
  const parsed = retailerInputSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  try {
    const retailer = await prisma.retailer.create({
      data: {
        ...parsed.data,
        contactPerson: parsed.data.contactPerson || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        paymentTerms: parsed.data.paymentTerms || null,
        notes: parsed.data.notes || null,
        magicToken: uuidv4(),
      },
    });
    revalidatePath("/retailers");
    bustRetailerCache();
    return { success: true, retailerId: retailer.id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes("code")) {
        return {
          success: false,
          fieldErrors: { code: ["This code is already in use"] },
        };
      }
      return {
        success: false,
        fieldErrors: { email: ["This email is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to create retailer") };
  }
}

export async function updateRetailer(
  id: string,
  data: RetailerInput
): Promise<ActionResult> {
  const parsed = retailerInputSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  try {
    await prisma.retailer.update({
      where: { id },
      data: {
        ...parsed.data,
        contactPerson: parsed.data.contactPerson || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        paymentTerms: parsed.data.paymentTerms || null,
        notes: parsed.data.notes || null,
      },
    });
    revalidatePath("/retailers");
    revalidatePath(`/retailers/${id}`);
    bustRetailerCache();
    return { success: true, retailerId: id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const meta = (err as { meta?: { target?: string[] } }).meta;
      if (meta?.target?.includes("code")) {
        return {
          success: false,
          fieldErrors: { code: ["This code is already in use"] },
        };
      }
      return {
        success: false,
        fieldErrors: { email: ["This email is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to update retailer") };
  }
}

export async function toggleRetailerActive(id: string): Promise<ActionResult> {
  try {
    const retailer = await prisma.retailer.findUnique({ where: { id } });
    if (!retailer) return { success: false, error: "Retailer not found" };

    await prisma.retailer.update({
      where: { id },
      data: { isActive: !retailer.isActive },
    });
    revalidatePath("/retailers");
    revalidatePath(`/retailers/${id}`);
    bustRetailerCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to toggle retailer status") };
  }
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export async function getRetailerPricing(retailerId: string) {
  const [products, prices] = await Promise.all([
    // Get all active products
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { skuCode: "asc" },
      select: { id: true, skuCode: true, name: true, msrp: true },
    }),
    // Get current prices for this retailer (effective_to IS NULL)
    prisma.retailerPricing.findMany({
      where: {
        retailerId,
        effectiveTo: null,
      },
      select: { id: true, productId: true, unitPrice: true },
    }),
  ]);

  // Build a map of productId -> pricing
  const priceMap = new Map(
    prices.map((p: { productId: string; id: string; unitPrice: unknown }) => [
      p.productId,
      p,
    ])
  );

  // Merge: all products with their pricing (or null)
  return products.map(
    (product: {
      id: string;
      skuCode: string;
      name: string;
      msrp: unknown;
    }) => {
      const pricing = priceMap.get(product.id) as
        | { id: string; unitPrice: unknown }
        | undefined;
      return {
        productId: product.id,
        skuCode: product.skuCode,
        productName: product.name,
        msrp: Number(product.msrp),
        unitPrice: pricing ? Number(pricing.unitPrice) : null,
        pricingId: pricing?.id ?? null,
      };
    }
  );
}

export async function upsertRetailerPrice(
  retailerId: string,
  productId: string,
  unitPrice: number
): Promise<ActionResult> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If there's an existing active price, close it
    await prisma.retailerPricing.updateMany({
      where: {
        retailerId,
        productId,
        effectiveTo: null,
      },
      data: {
        effectiveTo: today,
      },
    });

    // Create new pricing row
    await prisma.retailerPricing.create({
      data: {
        retailerId,
        productId,
        unitPrice,
        effectiveFrom: today,
      },
    });

    revalidatePath(`/retailers/${retailerId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to update price") };
  }
}

// ---------------------------------------------------------------------------
// Outlets
// ---------------------------------------------------------------------------

export async function getOutlets(retailerId: string) {
  return prisma.outlet.findMany({
    where: { retailerId },
    orderBy: { name: "asc" },
  });
}

export async function createOutlet(
  data: OutletInput
): Promise<ActionResult> {
  const parsed = outletInputSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  try {
    await prisma.outlet.create({
      data: {
        retailerId: parsed.data.retailerId,
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address || null,
        contactPerson: parsed.data.contactPerson || null,
        phone: parsed.data.phone || null,
      },
    });
    revalidatePath(`/retailers/${parsed.data.retailerId}`);
    bustRetailerCache();
    return { success: true };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { code: ["This outlet code already exists for this retailer"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to create outlet") };
  }
}

export async function updateOutlet(
  id: string,
  data: Omit<OutletInput, "retailerId">
): Promise<ActionResult> {
  const parsed = outletInputSchema
    .omit({ retailerId: true })
    .safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  try {
    const outlet = await prisma.outlet.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address || null,
        contactPerson: parsed.data.contactPerson || null,
        phone: parsed.data.phone || null,
      },
    });
    revalidatePath(`/retailers/${outlet.retailerId}`);
    bustRetailerCache();
    return { success: true };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { code: ["This outlet code already exists for this retailer"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to update outlet") };
  }
}

export async function toggleOutletActive(id: string): Promise<ActionResult> {
  try {
    const outlet = await prisma.outlet.findUnique({ where: { id } });
    if (!outlet) return { success: false, error: "Outlet not found" };

    await prisma.outlet.update({
      where: { id },
      data: { isActive: !outlet.isActive },
    });
    revalidatePath(`/retailers/${outlet.retailerId}`);
    bustRetailerCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to toggle outlet status") };
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function getRetailerInventory(retailerId: string) {
  type GroupResult = {
    productId: string;
    _sum: { quantityChange: number | null };
  };

  type OutletGroupResult = {
    productId: string;
    outletId: string | null;
    _sum: { quantityChange: number | null };
  };

  const [results, outletResults] = await Promise.all([
    // Overall totals grouped by product
    prisma.inventoryLedger.groupBy({
      by: ["productId"],
      where: { retailerId },
      _sum: { quantityChange: true },
    }),
    // Per-outlet totals
    prisma.inventoryLedger.groupBy({
      by: ["productId", "outletId"],
      where: { retailerId, outletId: { not: null } },
      _sum: { quantityChange: true },
    }),
  ]);

  const productIds = results.map((r: GroupResult) => r.productId);
  const outletIds = [
    ...new Set(
      outletResults
        .map((r: OutletGroupResult) => r.outletId)
        .filter((id): id is string => id !== null)
    ),
  ];

  // Get product and outlet details
  const [products, outlets] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, skuCode: true, name: true },
    }),
    outletIds.length
      ? prisma.outlet.findMany({
          where: { id: { in: outletIds } },
          select: { id: true, name: true, code: true },
        })
      : [],
  ]);

  const productMap = new Map(
    products.map((p: { id: string; skuCode: string; name: string }) => [
      p.id,
      p,
    ])
  );

  const outletMap = new Map(
    outlets.map((o: { id: string; name: string; code: string }) => [o.id, o])
  );

  // Build outlet breakdown per product
  const outletBreakdown = new Map<
    string,
    { outletId: string; outletName: string; outletCode: string; quantity: number }[]
  >();
  for (const r of outletResults as OutletGroupResult[]) {
    if (!r.outletId) continue;
    const qty = r._sum.quantityChange ?? 0;
    if (qty === 0) continue;
    const outlet = outletMap.get(r.outletId) as
      | { name: string; code: string }
      | undefined;
    if (!outletBreakdown.has(r.productId)) outletBreakdown.set(r.productId, []);
    outletBreakdown.get(r.productId)!.push({
      outletId: r.outletId,
      outletName: outlet?.name ?? "",
      outletCode: outlet?.code ?? "",
      quantity: qty,
    });
  }

  type InventoryItem = {
    productId: string;
    skuCode: string;
    productName: string;
    quantity: number;
    byOutlet: { outletId: string; outletName: string; outletCode: string; quantity: number }[];
  };

  return results
    .map((r: GroupResult): InventoryItem => {
      const product = productMap.get(r.productId) as
        | { skuCode: string; name: string }
        | undefined;
      return {
        productId: r.productId,
        skuCode: product?.skuCode ?? "",
        productName: product?.name ?? "",
        quantity: r._sum.quantityChange ?? 0,
        byOutlet: outletBreakdown.get(r.productId) ?? [],
      };
    })
    .filter((r: InventoryItem) => r.quantity !== 0)
    .sort((a: InventoryItem, b: InventoryItem) =>
      a.skuCode.localeCompare(b.skuCode)
    );
}
