"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentRole, isAdmin } from "@/lib/auth-utils";
import { errorMessage, retryOnUniqueViolation } from "@/lib/action-utils";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// A line item is either:
//   - a catalog product (productId set, description null), or
//   - an ad-hoc item (productId null, description set) — e.g. packaging,
//     freight, courier fees. Ad-hoc items do not affect inventory but DO
//     contribute to the supplier order subtotal and to the auto-generated
//     finance entry on Confirm Delivery.
const lineItemSchema = z
  .object({
    productId: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    orderedQty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    unitCost: z.coerce.number().min(0, "Unit cost must be >= 0"),
  })
  .superRefine((val, ctx) => {
    const hasProduct = !!val.productId && val.productId.length > 0;
    const hasDescription = !!val.description && val.description.trim().length > 0;
    if (!hasProduct && !hasDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productId"],
        message: "Pick a product or enter a description",
      });
    }
    if (hasProduct && hasDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Set product OR description, not both",
      });
    }
  });

const createSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  soNumber: z.string().optional(),
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  status: z.enum(["ORDERED", "IN_TRANSIT"]).default("ORDERED"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export type CreateSupplierOrderInput = z.infer<typeof createSchema>;

// Update keeps the existing status; status changes go through updateSupplierOrderStatus
// or confirmSupplierOrderDelivery. This lets DELIVERED orders be edited too.
const updateSchema = createSchema.omit({ status: true }).extend({
  id: z.string().min(1),
});
export type UpdateSupplierOrderInput = z.infer<typeof updateSchema>;

const confirmDeliverySchema = z.object({
  id: z.string().min(1),
  actualDeliveryDate: z.coerce.date(),
  receivedQuantities: z.array(
    z.object({
      lineItemId: z.string().min(1),
      receivedQty: z.coerce.number().int().min(0),
    })
  ),
});
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  supplierOrderId?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Sortable columns for the list page; unknown values fall back to
// orderDate newest-first. Keys are URL-facing, values are Prisma orderBy shapes.
// (Private const — "use server" modules may only export async functions.)
const supplierOrderSortFields: Record<
  string,
  (dir: "asc" | "desc") => Record<string, unknown>
> = {
  soNumber: (dir) => ({ soNumber: dir }),
  supplier: (dir) => ({ supplier: { name: dir } }),
  orderDate: (dir) => ({ orderDate: dir }),
  expectedDeliveryDate: (dir) => ({ expectedDeliveryDate: dir }),
  status: (dir) => ({ status: dir }),
  subtotal: (dir) => ({ subtotal: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
};

export async function getSupplierOrders(filters?: {
  supplierId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  dir?: string;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.supplierId) where.supplierId = filters.supplierId;
  if (filters?.status && filters.status !== "ALL") where.status = filters.status;
  if (filters?.dateFrom || filters?.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
    if (filters.dateTo) range.lte = new Date(filters.dateTo);
    where.orderDate = range;
  }

  const sortFn =
    (filters?.sort && supplierOrderSortFields[filters.sort]) ||
    supplierOrderSortFields.orderDate;

  return prisma.supplierOrder.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, code: true } },
      _count: { select: { lineItems: true } },
    },
    orderBy: sortFn(filters?.dir === "asc" ? "asc" : "desc"),
  });
}

export async function getSupplierOrder(id: string) {
  return prisma.supplierOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
        },
        orderBy: { id: "asc" },
      },
      adjustments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// SO Number Generation: #SO-<supplierCode>-<year><seq>
// ---------------------------------------------------------------------------

export async function generateSoNumber(supplierId: string): Promise<string> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { code: true },
  });
  if (!supplier) throw new Error("Supplier not found");

  const year = new Date().getFullYear();
  const prefix = `#SO-${supplier.code}-${year}`;

  const existing = await prisma.supplierOrder.findMany({
    where: { soNumber: { startsWith: prefix } },
    select: { soNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const suffix = row.soNumber.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Product quick-create (used by supplier order form)
// ---------------------------------------------------------------------------

const quickProductSchema = z.object({
  skuCode: z.string().min(1, "SKU code is required"),
  name: z.string().min(1, "Name is required"),
  msrp: z.coerce.number().min(0).default(0),
});

export async function quickCreateProduct(data: {
  skuCode: string;
  name: string;
  msrp?: number;
}): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  product?: { id: string; skuCode: string; name: string };
}> {
  const parsed = quickProductSchema.safeParse(data);
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
    const product = await prisma.product.create({
      data: {
        skuCode: parsed.data.skuCode.trim(),
        name: parsed.data.name.trim(),
        msrp: parsed.data.msrp,
      },
      select: { id: true, skuCode: true, name: true },
    });
    revalidatePath("/products");
    return { success: true, product };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { skuCode: ["This SKU code is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to create product") };
  }
}

export async function getProductsForPicker() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, skuCode: true, name: true },
    orderBy: { skuCode: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createSupplierOrder(
  data: CreateSupplierOrderInput
): Promise<ActionResult> {
  // Staff cannot see or submit costs — force to 0 server-side regardless of client input.
  const role = await getCurrentRole();
  if (role !== "admin" && Array.isArray(data?.lineItems)) {
    data = {
      ...data,
      lineItems: data.lineItems.map((li) => ({ ...li, unitCost: 0 })),
    };
  }

  const parsed = createSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const {
    supplierId,
    soNumber: customSoNumber,
    orderDate,
    expectedDeliveryDate,
    notes,
    status,
    lineItems,
  } = parsed.data;

  // Resolve SO number
  let soNumber: string;
  if (customSoNumber && customSoNumber.trim()) {
    soNumber = customSoNumber.trim();
    const existing = await prisma.supplierOrder.findUnique({
      where: { soNumber },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        fieldErrors: { soNumber: ["This SO number is already in use"] },
      };
    }
  } else {
    soNumber = await generateSoNumber(supplierId);
  }

  const items = lineItems.map((li) => ({
    productId: li.productId && li.productId.length > 0 ? li.productId : null,
    description:
      li.description && li.description.trim().length > 0
        ? li.description.trim()
        : null,
    orderedQty: li.orderedQty,
    unitCost: li.unitCost,
    lineTotal: Number((li.orderedQty * li.unitCost).toFixed(2)),
  }));
  const subtotal = items.reduce((s, li) => s + li.lineTotal, 0);

  const wasAutoNumbered = !(customSoNumber && customSoNumber.trim());

  try {
    // Auto-generated numbers can race: two concurrent creates both compute
    // maxSeq+1 and one hits the unique constraint. Regenerate and retry;
    // custom numbers were validated above and should fail loudly instead.
    const createOnce = async (retryIdx: number) => {
      if (retryIdx > 0 && wasAutoNumbered) {
        soNumber = await generateSoNumber(supplierId);
      }
      return prisma.supplierOrder.create({
        data: {
          soNumber,
          supplierId,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate ?? null,
          status,
          notes: notes || null,
          subtotal,
          lineItems: { create: items },
        },
      });
    };

    let attempt = 0;
    const so = wasAutoNumbered
      ? await retryOnUniqueViolation(() => createOnce(attempt++), "so_number")
      : await createOnce(0);

    revalidatePath("/supplier-orders");
    return { success: true, supplierOrderId: so.id };
  } catch (err) {
    console.error("Failed to create supplier order:", err);
    return {
      success: false,
      error: errorMessage(err, "Failed to create supplier order"),
    };
  }
}

export async function updateSupplierOrder(
  data: UpdateSupplierOrderInput
): Promise<ActionResult> {
  // Staff cannot see or edit costs — keep each line's existing unitCost
  // when staff submits the form. New lines a staff user adds default to 0.
  // Product lines are matched by productId; ad-hoc lines by description (case-
  // insensitive trim) since there's no stable id to match on. New ad-hoc lines
  // therefore also default to 0 unless an existing description matches.
  const role = await getCurrentRole();
  if (role !== "admin" && data?.id && Array.isArray(data?.lineItems)) {
    const existingLines = await prisma.supplierOrderLineItem.findMany({
      where: { supplierOrderId: data.id },
      select: { productId: true, description: true, unitCost: true },
    });
    const costByProduct = new Map<string, number>();
    const costByDescription = new Map<string, number>();
    for (const l of existingLines) {
      if (l.productId) {
        costByProduct.set(l.productId, Number(l.unitCost));
      } else if (l.description) {
        costByDescription.set(l.description.trim().toLowerCase(), Number(l.unitCost));
      }
    }
    data = {
      ...data,
      lineItems: data.lineItems.map((li) => {
        const productId = li.productId ?? undefined;
        const description = li.description?.trim() ?? "";
        const preservedCost = productId
          ? costByProduct.get(productId)
          : description
            ? costByDescription.get(description.toLowerCase())
            : undefined;
        return { ...li, unitCost: preservedCost ?? 0 };
      }),
    };
  }

  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const {
    id,
    supplierId,
    soNumber: customSoNumber,
    orderDate,
    expectedDeliveryDate,
    notes,
    lineItems,
  } = parsed.data;

  const existing = await prisma.supplierOrder.findUnique({
    where: { id },
    select: { id: true, soNumber: true },
  });
  if (!existing) return { success: false, error: "Supplier order not found" };

  let soNumber = existing.soNumber;
  if (customSoNumber && customSoNumber.trim()) {
    const trimmed = customSoNumber.trim();
    if (trimmed !== existing.soNumber) {
      const dup = await prisma.supplierOrder.findUnique({
        where: { soNumber: trimmed },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        return {
          success: false,
          fieldErrors: { soNumber: ["This SO number is already in use"] },
        };
      }
      soNumber = trimmed;
    }
  }

  const items = lineItems.map((li) => ({
    productId: li.productId && li.productId.length > 0 ? li.productId : null,
    description:
      li.description && li.description.trim().length > 0
        ? li.description.trim()
        : null,
    orderedQty: li.orderedQty,
    unitCost: li.unitCost,
    lineTotal: Number((li.orderedQty * li.unitCost).toFixed(2)),
  }));
  const subtotal = items.reduce((s, li) => s + li.lineTotal, 0);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplierOrderLineItem.deleteMany({ where: { supplierOrderId: id } });
      await tx.supplierOrder.update({
        where: { id },
        data: {
          soNumber,
          supplierId,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate ?? null,
          notes: notes || null,
          subtotal,
          lineItems: { create: items },
        },
      });
    });
    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${id}`);
    return { success: true, supplierOrderId: id };
  } catch (err) {
    console.error("Failed to update supplier order:", err);
    return { success: false, error: errorMessage(err, "Failed to update supplier order") };
  }
}

export async function updateSupplierOrderStatus(
  id: string,
  status: "ORDERED" | "IN_TRANSIT" | "CANCELLED"
): Promise<ActionResult> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!so) return { success: false, error: "Supplier order not found" };
  if (so.status === "DELIVERED") {
    return { success: false, error: "Cannot change status of a delivered order" };
  }

  try {
    await prisma.supplierOrder.update({ where: { id }, data: { status } });
    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${id}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to update status") };
  }
}

export async function confirmSupplierOrderDelivery(
  data: ConfirmDeliveryInput
): Promise<ActionResult> {
  const parsed = confirmDeliverySchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const { id, actualDeliveryDate, receivedQuantities } = parsed.data;

  const so = await prisma.supplierOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      lineItems: { select: { id: true, orderedQty: true, lineTotal: true } },
    },
  });
  if (!so) return { success: false, error: "Supplier order not found" };
  if (so.status === "DELIVERED") {
    return { success: false, error: "This order is already delivered" };
  }

  const receivedMap = new Map(
    receivedQuantities.map((r) => [r.lineItemId, r.receivedQty])
  );

  try {
    await prisma.$transaction(async (tx) => {
      // Write received quantities per line item — parallelized so we don't
      // blow through the 5s default transaction timeout on supplier orders
      // with many SKUs (P2028).
      await Promise.all(
        so.lineItems.map((li) => {
          const received = receivedMap.get(li.id) ?? li.orderedQty;
          return tx.supplierOrderLineItem.update({
            where: { id: li.id },
            data: { receivedQty: received },
          });
        }),
      );

      // Mark SO as delivered
      await tx.supplierOrder.update({
        where: { id },
        data: { status: "DELIVERED", actualDeliveryDate },
      });

      // Auto-create finance entry (Inventory category) — guard against duplicates
      const existing = await tx.financeEntry.findFirst({
        where: { supplierOrderId: id, category: "INVENTORY" },
      });
      if (!existing) {
        await tx.financeEntry.create({
          data: {
            category: "INVENTORY",
            entryDate: actualDeliveryDate,
            amount: so.subtotal,
            description: `${so.soNumber} \u2014 ${so.supplier.name}`,
            supplierId: so.supplier.id,
            supplierOrderId: id,
          },
        });
      }
    }, { maxWait: 10_000, timeout: 30_000 });

    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${id}`);
    revalidatePath("/finance");
    revalidatePath("/finance/entries");
    return { success: true };
  } catch (err) {
    console.error("Failed to confirm delivery:", err);
    const message =
      err instanceof Error && err.message
        ? err.message.split("\n")[0]
        : "Failed to confirm delivery";
    return { success: false, error: message };
  }
}

// Adjust a line item's ordered qty by `delta` (positive to add, negative to
// reduce). Recomputes lineTotal and SO subtotal. If qty hits zero the line is
// removed.
export async function adjustSupplierOrderLineQty(
  lineItemId: string,
  delta: number,
  reason: string
): Promise<ActionResult> {
  if (!Number.isFinite(delta) || delta === 0 || !Number.isInteger(delta)) {
    return { success: false, error: "Adjustment must be a non-zero integer" };
  }
  const trimmedReason = (reason ?? "").trim();
  if (trimmedReason.length < 3) {
    return {
      success: false,
      fieldErrors: { reason: ["Please provide a reason (min 3 characters)"] },
    };
  }

  const li = await prisma.supplierOrderLineItem.findUnique({
    where: { id: lineItemId },
    select: {
      id: true,
      orderedQty: true,
      unitCost: true,
      supplierOrderId: true,
      description: true,
      product: { select: { skuCode: true, name: true } },
      supplierOrder: { select: { status: true } },
    },
  });
  if (!li) return { success: false, error: "Line item not found" };
  if (li.supplierOrder.status === "DELIVERED" || li.supplierOrder.status === "CANCELLED") {
    return {
      success: false,
      error: "Cannot adjust a delivered or cancelled supplier order",
    };
  }
  const qtyBefore = li.orderedQty;
  const qtyAfter = qtyBefore + delta;
  if (qtyAfter < 0) {
    return {
      success: false,
      error: `Cannot reduce below zero (current: ${qtyBefore})`,
    };
  }
  const unitCost = Number(li.unitCost);
  const newLineTotal = Number((qtyAfter * unitCost).toFixed(2));

  try {
    await prisma.$transaction(async (tx) => {
      let lineItemIdForLog: string | null = lineItemId;
      if (qtyAfter === 0) {
        await tx.supplierOrderLineItem.delete({ where: { id: lineItemId } });
        lineItemIdForLog = null;
      } else {
        await tx.supplierOrderLineItem.update({
          where: { id: lineItemId },
          data: { orderedQty: qtyAfter, lineTotal: newLineTotal },
        });
      }
      const remaining = await tx.supplierOrderLineItem.findMany({
        where: { supplierOrderId: li.supplierOrderId },
        select: { lineTotal: true },
      });
      const subtotal = remaining.reduce((s, r) => s + Number(r.lineTotal), 0);
      await tx.supplierOrder.update({
        where: { id: li.supplierOrderId },
        data: { subtotal },
      });
      await tx.supplierOrderAdjustment.create({
        data: {
          supplierOrderId: li.supplierOrderId,
          lineItemId: lineItemIdForLog,
          // Ad-hoc lines have no SKU — log a placeholder so the column stays
          // populated, and put the description into productName.
          productSku: li.product?.skuCode ?? "—",
          productName: li.product?.name ?? li.description ?? "Other item",
          delta,
          qtyBefore,
          qtyAfter,
          reason: trimmedReason,
        },
      });
    });
    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${li.supplierOrderId}`);
    return { success: true, supplierOrderId: li.supplierOrderId };
  } catch (err) {
    console.error("Failed to adjust line qty:", err);
    return { success: false, error: errorMessage(err, "Failed to adjust line qty") };
  }
}

// Update payment (amount paid). Recomputes paymentStatus from amount vs subtotal.
// Admin only — payment tracking is not visible to staff.
export async function updateSupplierOrderPayment(
  id: string,
  amountPaid: number
): Promise<ActionResult> {
  if (!(await isAdmin())) {
    return { success: false, error: "Forbidden" };
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { success: false, error: "Amount paid must be a non-negative number" };
  }
  const so = await prisma.supplierOrder.findUnique({
    where: { id },
    select: { subtotal: true },
  });
  if (!so) return { success: false, error: "Supplier order not found" };

  const subtotal = Number(so.subtotal);
  const rounded = Number(amountPaid.toFixed(2));
  if (rounded > subtotal + 0.009) {
    return {
      success: false,
      fieldErrors: {
        amountPaid: [`Amount paid cannot exceed subtotal (${subtotal.toFixed(2)})`],
      },
    };
  }

  let paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  if (rounded <= 0) paymentStatus = "UNPAID";
  else if (rounded >= subtotal - 0.009) paymentStatus = "PAID";
  else paymentStatus = "PARTIALLY_PAID";

  try {
    await prisma.supplierOrder.update({
      where: { id },
      data: { amountPaid: rounded, paymentStatus },
    });
    revalidatePath("/supplier-orders");
    revalidatePath(`/supplier-orders/${id}`);
    revalidatePath("/finance");
    return { success: true, supplierOrderId: id };
  } catch (err) {
    console.error("Failed to update payment:", err);
    return { success: false, error: errorMessage(err, "Failed to update payment") };
  }
}

export async function deleteSupplierOrder(id: string): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      // Detach any auto-created finance entry
      await tx.financeEntry.deleteMany({ where: { supplierOrderId: id } });
      await tx.supplierOrder.delete({ where: { id } });
    });
    revalidatePath("/supplier-orders");
    revalidatePath("/finance");
    revalidatePath("/finance/entries");
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to delete supplier order") };
  }
}
