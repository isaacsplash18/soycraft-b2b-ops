"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath, unstable_cache } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-utils";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { errorMessage, retryOnUniqueViolation } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const lineItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price must be >= 0"),
});

const createDoSchema = z.object({
  retailerId: z.string().min(1, "Retailer is required"),
  outletId: z.string().optional(),
  doNumber: z.string().optional(),
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  sourceReference: z.string().optional(),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

const updateDoSchema = z.object({
  doNumber: z.string().optional(),
  notes: z.string().optional(),
  sourceReference: z.string().optional(),
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export type CreateDoInput = z.infer<typeof createDoSchema>;
export type UpdateDoInput = z.infer<typeof updateDoSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  deliveryOrderId?: string;
};

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

// Sortable columns for the list page; unknown values fall back to
// newest-first. Keys are URL-facing, values are Prisma orderBy shapes.
// (Private const — "use server" modules may only export async functions.)
const deliveryOrderSortFields: Record<
  string,
  (dir: "asc" | "desc") => Record<string, unknown>
> = {
  doNumber: (dir) => ({ doNumber: dir }),
  retailer: (dir) => ({ retailer: { name: dir } }),
  orderDate: (dir) => ({ orderDate: dir }),
  deliveryDate: (dir) => ({ deliveryDate: dir }),
  status: (dir) => ({ status: dir }),
  subtotal: (dir) => ({ subtotal: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
};

export async function getDeliveryOrders(filters?: {
  status?: string;
  retailerId?: string;
  search?: string;
  sort?: string;
  dir?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters?.retailerId) {
    where.retailerId = filters.retailerId;
  }

  if (filters?.search) {
    where.OR = [
      { doNumber: { contains: filters.search, mode: "insensitive" } },
      { retailer: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  const sortFn =
    (filters?.sort && deliveryOrderSortFields[filters.sort]) ||
    deliveryOrderSortFields.createdAt;

  return prisma.deliveryOrder.findMany({
    where,
    include: {
      retailer: { select: { id: true, name: true } },
      outlet: { select: { id: true, name: true, code: true } },
    },
    orderBy: sortFn(filters?.dir === "asc" ? "asc" : "desc"),
  });
}

export async function getDeliveryOrder(id: string) {
  return prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      retailer: true,
      outlet: { select: { id: true, name: true, code: true } },
      lineItems: {
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
        },
        orderBy: { product: { skuCode: "asc" } },
      },
      createdBy: { select: { name: true } },
    },
  });
}

export async function generateDoNumber(retailerId: string, outletId?: string): Promise<string> {
  // Fetch retailer code
  const retailer = await prisma.retailer.findUnique({
    where: { id: retailerId },
    select: { code: true },
  });
  if (!retailer) throw new Error("Retailer not found");

  let combined = retailer.code;

  // If outletId, fetch outlet code
  if (outletId) {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { code: true },
    });
    if (outlet) {
      combined = retailer.code + outlet.code;
    }
  }

  const year = new Date().getFullYear();
  const prefix = `#DO-${combined}-${year}`;

  // Find all existing DOs matching this prefix pattern
  const existing = await prisma.deliveryOrder.findMany({
    where: { doNumber: { startsWith: prefix } },
    select: { doNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const suffix = row.doNumber.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Retailer Outlets (for DO form)
// ---------------------------------------------------------------------------

export async function getRetailerOutlets(retailerId: string) {
  return prisma.outlet.findMany({
    where: { retailerId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createDeliveryOrder(
  data: CreateDoInput
): Promise<ActionResult> {
  const parsed = createDoSchema.safeParse(data);
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

  const {
    retailerId,
    outletId,
    doNumber: customDoNumber,
    orderDate,
    deliveryDate,
    notes,
    sourceReference,
    status,
    lineItems,
  } = parsed.data;

  // Determine DO number: use custom if provided, otherwise auto-generate
  let doNumber: string;
  if (customDoNumber && customDoNumber.trim()) {
    doNumber = customDoNumber.trim();
    // Validate uniqueness
    const existing = await prisma.deliveryOrder.findUnique({
      where: { doNumber },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        fieldErrors: { doNumber: ["This DO number is already in use"] },
      };
    }
  } else {
    doNumber = await generateDoNumber(retailerId, outletId || undefined);
  }

  // Calculate line totals and subtotal
  const enrichedItems = lineItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
  }));

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const wasAutoNumbered = !(customDoNumber && customDoNumber.trim());

  try {
    // Auto-generated numbers can race: two concurrent creates both compute
    // maxSeq+1 and one hits the unique constraint. Regenerate and retry;
    // custom numbers were validated above and should fail loudly instead.
    const createOnce = async (retryIdx: number) => {
      if (retryIdx > 0 && wasAutoNumbered) {
        doNumber = await generateDoNumber(retailerId, outletId || undefined);
      }
      return prisma.deliveryOrder.create({
        data: {
          doNumber,
          retailerId,
          outletId: outletId || null,
          orderDate,
          deliveryDate: deliveryDate ?? null,
          status,
          notes: notes || null,
          sourceReference: sourceReference || null,
          subtotal,
          createdById: userId,
          lineItems: {
            create: enrichedItems,
          },
        },
      });
    };

    let attempt = 0;
    const order = wasAutoNumbered
      ? await retryOnUniqueViolation(() => createOnce(attempt++), "do_number")
      : await createOnce(0);

    revalidatePath("/delivery-orders");
    return { success: true, deliveryOrderId: order.id };
  } catch (err) {
    console.error("Failed to create delivery order:", err);
    return {
      success: false,
      error: errorMessage(err, "Failed to create delivery order"),
    };
  }
}

export async function updateDeliveryOrder(
  id: string,
  data: UpdateDoInput
): Promise<ActionResult> {
  const parsed = updateDoSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  await requireUser();

  // Check the order exists and is editable
  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!order) return { success: false, error: "Delivery order not found" };

  if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
    return {
      success: false,
      error: "Only DRAFT or CONFIRMED orders can be edited",
    };
  }

  const { doNumber, notes, sourceReference, orderDate, deliveryDate, lineItems } = parsed.data;

  // Calculate line totals and subtotal
  const enrichedItems = lineItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
  }));

  const subtotal = enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  try {
    await prisma.$transaction(async (tx) => {
      // Delete existing line items
      await tx.deliveryOrderLineItem.deleteMany({
        where: { deliveryOrderId: id },
      });

      // Update order and create new line items
      await tx.deliveryOrder.update({
        where: { id },
        data: {
          ...(doNumber ? { doNumber } : {}),
          notes: notes || null,
          sourceReference: sourceReference || null,
          orderDate: orderDate ?? undefined,
          deliveryDate: deliveryDate ?? null,
          subtotal,
          lineItems: {
            create: enrichedItems,
          },
        },
      });
    });

    revalidatePath("/delivery-orders");
    revalidatePath(`/delivery-orders/${id}`);
    return { success: true, deliveryOrderId: id };
  } catch (err) {
    console.error("Failed to update delivery order:", err);
    return { success: false, error: errorMessage(err, "Failed to update delivery order") };
  }
}

export async function updateDeliveryOrderStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  const userId = await requireUser();

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      lineItems: {
        include: { product: true },
      },
      retailer: true,
    },
  });

  if (!order) return { success: false, error: "Delivery order not found" };

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["DELIVERED", "CANCELLED"],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    return {
      success: false,
      error: `Cannot transition from ${order.status} to ${status}`,
    };
  }

  try {
    if (status === "DELIVERED") {
      // Build ops as an array — `$transaction([...])` works under PgBouncer
      // transaction pooling (interactive `$transaction(async tx => ...)` does not).
      const ops: Prisma.PrismaPromise<unknown>[] = [
        prisma.deliveryOrder.update({
          where: { id },
          data: {
            status: "DELIVERED",
            deliveryDate: order.deliveryDate ?? new Date(),
          },
        }),
      ];

      for (const item of order.lineItems) {
        ops.push(
          prisma.inventoryLedger.create({
            data: {
              productId: item.productId,
              retailerId: null,
              outletId: null,
              quantityChange: -item.quantity,
              movementType: "DISPATCH_TO_RETAILER",
              referenceType: "delivery_order",
              referenceId: order.id,
              notes: `DO ${order.doNumber} - dispatched to ${order.retailer.name}`,
              createdById: userId,
            },
          })
        );
        ops.push(
          prisma.inventoryLedger.create({
            data: {
              productId: item.productId,
              retailerId: order.retailerId,
              outletId: order.outletId ?? null,
              quantityChange: item.quantity,
              movementType: "RECEIVE_AT_RETAILER",
              referenceType: "delivery_order",
              referenceId: order.id,
              notes: `DO ${order.doNumber} - received at ${order.retailer.name}`,
              createdById: userId,
            },
          })
        );
      }

      await prisma.$transaction(ops);
    } else {
      await prisma.deliveryOrder.update({
        where: { id },
        data: { status: status as "CONFIRMED" | "CANCELLED" },
      });
    }

    revalidatePath("/delivery-orders");
    revalidatePath(`/delivery-orders/${id}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to update delivery order status:", err);
    return { success: false, error: errorMessage(err, "Failed to update status") };
  }
}

export async function cancelDeliveryOrder(id: string): Promise<ActionResult> {
  return updateDeliveryOrderStatus(id, "CANCELLED");
}

// ---------------------------------------------------------------------------
// Retailer Products with Pricing
// ---------------------------------------------------------------------------

export async function getRetailerProducts(retailerId: string, outletId?: string) {
  // outletId accepted for pass-through; pricing is retailer-level
  void outletId;

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
    prices.map((p: { productId: string; unitPrice: unknown }) => [p.productId, Number(p.unitPrice)])
  );

  return products.map((product: { id: string; skuCode: string; name: string; msrp: unknown }) => ({
    id: product.id,
    skuCode: product.skuCode,
    name: product.name,
    unitPrice: priceMap.get(product.id) ?? Number(product.msrp) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Retailers list (for dropdowns)
// ---------------------------------------------------------------------------

const _getActiveRetailers = unstable_cache(
  async () =>
    prisma.retailer.findMany({
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
    }),
  ["getActiveRetailers", "delivery-orders"],
  { tags: [CACHE_TAGS.activeRetailers], revalidate: 300 },
);

export async function getActiveRetailers() {
  return _getActiveRetailers();
}

// ---------------------------------------------------------------------------
// Duplicate guard (form warning, non-blocking)
// ---------------------------------------------------------------------------

// Returns existing non-cancelled DO numbers for the same retailer/outlet on
// the same order date, so the form can warn about likely double entry.
export async function findSimilarDeliveryOrders(params: {
  retailerId: string;
  outletId?: string | null;
  orderDate: string; // yyyy-mm-dd
  excludeId?: string;
}): Promise<{ doNumber: string; id: string }[]> {
  const { retailerId, outletId, orderDate, excludeId } = params;
  if (!retailerId || !orderDate) return [];

  const day = new Date(orderDate);
  if (isNaN(day.getTime())) return [];

  return prisma.deliveryOrder.findMany({
    where: {
      retailerId,
      outletId: outletId || null,
      orderDate: day,
      status: { not: "CANCELLED" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, doNumber: true },
    take: 3,
  });
}
