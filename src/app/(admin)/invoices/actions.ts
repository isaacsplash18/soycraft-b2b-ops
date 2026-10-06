"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

const _getGstRate = unstable_cache(
  async (): Promise<number> => {
    const setting = await prisma.settings.findUnique({
      where: { key: "gst_rate" },
    });
    return setting ? parseFloat(setting.value) : 0.09;
  },
  ["getGstRate"],
  { tags: [CACHE_TAGS.settings], revalidate: 3600 },
);

async function getGstRate(): Promise<number> {
  return _getGstRate();
}

function parseDueDays(paymentTerms: string | null): number {
  if (!paymentTerms) return 30;
  const lower = paymentTerms.toLowerCase().trim();
  if (lower === "cod") return 0;
  const match = lower.match(/net\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 30;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const productLineItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0, "Unit price must be >= 0"),
});

const adHocLineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number(), // can be negative for discounts
});

const createInvoiceSchema = z.object({
  retailerId: z.string().min(1, "Retailer is required"),
  outletId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  sourceReference: z.string().optional(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  productLineItems: z.array(productLineItemSchema),
  adHocLineItems: z.array(adHocLineItemSchema),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  invoiceId?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Sortable columns for the list page; unknown values fall back to
// newest-first. Keys are URL-facing, values are Prisma orderBy shapes.
// (Private const — "use server" modules may only export async functions.)
const invoiceSortFields: Record<
  string,
  (dir: "asc" | "desc") => Record<string, unknown>
> = {
  invoiceDate: (dir) => ({ invoiceDate: dir }),
  dueDate: (dir) => ({ dueDate: dir }),
  total: (dir) => ({ total: dir }),
  status: (dir) => ({ status: dir }),
  retailer: (dir) => ({ retailer: { name: dir } }),
  createdAt: (dir) => ({ createdAt: dir }),
};

export async function getInvoices(filters?: {
  status?: string;
  retailerId?: string;
  month?: string; // "YYYY-MM"
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

  if (filters?.month) {
    const [year, mon] = filters.month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);
    where.billingMonth = { gte: start, lt: end };
  }

  const sortFn =
    (filters?.sort && invoiceSortFields[filters.sort]) ||
    invoiceSortFields.createdAt;

  return prisma.invoice.findMany({
    where,
    include: {
      retailer: { select: { id: true, name: true, type: true } },
      outlet: { select: { id: true, name: true } },
    },
    orderBy: sortFn(filters?.dir === "asc" ? "asc" : "desc"),
  });
}

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      retailer: true,
      outlet: { select: { id: true, name: true, code: true } },
      lineItems: {
        include: {
          product: { select: { id: true, skuCode: true, name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Invoice Number Generation: INV-YYYYMM-NNN
// ---------------------------------------------------------------------------

export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${yyyymm}-`;

  const existing = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
  });

  let maxSeq = 0;
  for (const row of existing) {
    const suffix = row.invoiceNumber.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Retailer Products with Pricing (for invoice form)
// ---------------------------------------------------------------------------

export async function getRetailerProductsForInvoice(retailerId: string) {
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
// Retailer Outlets (for invoice form)
// ---------------------------------------------------------------------------

export async function getRetailerOutletsForInvoice(retailerId: string) {
  return prisma.outlet.findMany({
    where: { retailerId, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Create Invoice
// ---------------------------------------------------------------------------

export async function createInvoice(
  data: CreateInvoiceInput
): Promise<ActionResult> {
  const parsed = createInvoiceSchema.safeParse(data);
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
    invoiceNumber: customInvoiceNumber,
    sourceReference,
    invoiceDate,
    dueDate,
    notes,
    status,
    productLineItems,
    adHocLineItems,
  } = parsed.data;

  // At least one line item required
  if (productLineItems.length === 0 && adHocLineItems.length === 0) {
    return { success: false, error: "At least one line item is required" };
  }

  // Determine invoice number
  let invoiceNumber: string;
  if (customInvoiceNumber && customInvoiceNumber.trim()) {
    invoiceNumber = customInvoiceNumber.trim();
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        fieldErrors: { invoiceNumber: ["This invoice number is already in use"] },
      };
    }
  } else {
    invoiceNumber = await generateInvoiceNumber();
  }

  const gstRate = await getGstRate();

  // Build product line items
  const productItems = productLineItems.map((item) => ({
    productId: item.productId,
    description: null as string | null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    referenceType: null as string | null,
    referenceId: null as string | null,
  }));

  // Build ad-hoc line items
  const adHocItems = adHocLineItems.map((item) => ({
    productId: null as string | null,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    referenceType: null as string | null,
    referenceId: null as string | null,
  }));

  const allItems = [...productItems, ...adHocItems];
  const subtotal = allItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const gstAmount = Number((subtotal * gstRate).toFixed(2));
  const total = Number((subtotal + gstAmount).toFixed(2));

  // billingMonth from invoiceDate (first of month)
  const billingMonth = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          retailerId,
          outletId: outletId || null,
          invoiceDate,
          dueDate,
          billingMonth,
          status: status === "CONFIRMED" ? "SENT" : "DRAFT",
          subtotal,
          gstRate,
          gstAmount,
          total,
          notes: notes || null,
          sourceReference: sourceReference || null,
          sourceType: null,
          lineItems: {
            create: allItems,
          },
        },
      });

      // If confirming, create inventory ledger entries for product items
      if (status === "CONFIRMED") {
        const retailer = await tx.retailer.findUnique({
          where: { id: retailerId },
          select: { name: true },
        });

        for (const item of productItems) {
          if (!item.productId) continue;

          // Reduce stock at retailer/outlet
          await tx.inventoryLedger.create({
            data: {
              productId: item.productId,
              retailerId,
              outletId: outletId || null,
              quantityChange: -item.quantity,
              movementType: "SELL_THROUGH",
              referenceType: "invoice",
              referenceId: invoice.id,
              notes: `Invoice ${invoiceNumber} - sold at ${retailer?.name ?? "retailer"}`,
              createdById: userId,
            },
          });
        }
      }

      return invoice;
    });

    revalidatePath("/invoices");
    return { success: true, invoiceId: result.id };
  } catch (err) {
    console.error("Failed to create invoice:", err);
    return { success: false, error: errorMessage(err, "Failed to create invoice") };
  }
}

// ---------------------------------------------------------------------------
// Update Invoice (DRAFT only)
// ---------------------------------------------------------------------------

const updateInvoiceSchema = createInvoiceSchema.extend({
  id: z.string().min(1),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export async function updateInvoice(
  data: UpdateInvoiceInput
): Promise<ActionResult> {
  const parsed = updateInvoiceSchema.safeParse(data);
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
    retailerId,
    outletId,
    invoiceNumber: customInvoiceNumber,
    sourceReference,
    invoiceDate,
    dueDate,
    notes,
    productLineItems,
    adHocLineItems,
  } = parsed.data;

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, invoiceNumber: true },
  });
  if (!existing) return { success: false, error: "Invoice not found" };
  if (existing.status !== "DRAFT") {
    return { success: false, error: "Only draft invoices can be edited" };
  }

  if (productLineItems.length === 0 && adHocLineItems.length === 0) {
    return { success: false, error: "At least one line item is required" };
  }

  // Validate invoice number uniqueness if changed
  let invoiceNumber = existing.invoiceNumber;
  if (customInvoiceNumber && customInvoiceNumber.trim()) {
    const trimmed = customInvoiceNumber.trim();
    if (trimmed !== existing.invoiceNumber) {
      const dup = await prisma.invoice.findUnique({
        where: { invoiceNumber: trimmed },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        return {
          success: false,
          fieldErrors: { invoiceNumber: ["This invoice number is already in use"] },
        };
      }
      invoiceNumber = trimmed;
    }
  }

  const gstRate = await getGstRate();

  const productItems = productLineItems.map((item) => ({
    productId: item.productId,
    description: null as string | null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    referenceType: null as string | null,
    referenceId: null as string | null,
  }));

  const adHocItems = adHocLineItems.map((item) => ({
    productId: null as string | null,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    referenceType: null as string | null,
    referenceId: null as string | null,
  }));

  const allItems = [...productItems, ...adHocItems];
  const subtotal = allItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const gstAmount = Number((subtotal * gstRate).toFixed(2));
  const total = Number((subtotal + gstAmount).toFixed(2));
  const billingMonth = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber,
          retailerId,
          outletId: outletId || null,
          invoiceDate,
          dueDate,
          billingMonth,
          subtotal,
          gstRate,
          gstAmount,
          total,
          notes: notes || null,
          sourceReference: sourceReference || null,
          lineItems: { create: allItems },
        },
      });
    });

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoiceId: id };
  } catch (err) {
    console.error("Failed to update invoice:", err);
    return { success: false, error: errorMessage(err, "Failed to update invoice") };
  }
}

// ---------------------------------------------------------------------------
// Update Invoice Status
// ---------------------------------------------------------------------------

export async function updateInvoiceStatus(
  id: string,
  status: "SENT" | "PAID" | "VOID"
) {
  const userId = await requireUser();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: true,
      retailer: { select: { name: true } },
    },
  });

  if (!invoice) return { success: false, error: "Invoice not found" };

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    DRAFT: ["SENT", "VOID"],
    SENT: ["PAID", "VOID"],
    OVERDUE: ["PAID", "VOID"],
  };

  if (!validTransitions[invoice.status]?.includes(status)) {
    return {
      success: false,
      error: `Cannot transition from ${invoice.status} to ${status}`,
    };
  }

  const data: Record<string, unknown> = { status };
  if (status === "PAID") {
    data.paidAt = new Date();
  }

  try {
    // If transitioning DRAFT -> SENT, also create inventory ledger entries
    if (invoice.status === "DRAFT" && status === "SENT") {
      await prisma.$transaction(
        async (tx) => {
          await tx.invoice.update({ where: { id }, data });

          // Check if inventory entries already exist for this invoice
          const existingEntries = await tx.inventoryLedger.findFirst({
            where: { referenceType: "invoice", referenceId: id },
          });

          if (!existingEntries) {
            // Parallelize the per-line-item ledger writes so we don't blow
            // through the 5s default transaction timeout on invoices with
            // many SKUs (P2028). Same pattern as confirmSupplierOrderDelivery.
            const productLines = invoice.lineItems.filter((li) => li.productId);
            await Promise.all(
              productLines.map((item) =>
                tx.inventoryLedger.create({
                  data: {
                    productId: item.productId!,
                    retailerId: invoice.retailerId,
                    outletId: invoice.outletId ?? null,
                    quantityChange: -item.quantity,
                    movementType: "SELL_THROUGH",
                    referenceType: "invoice",
                    referenceId: invoice.id,
                    notes: `Invoice ${invoice.invoiceNumber} - sold at ${invoice.retailer.name}`,
                    createdById: userId,
                  },
                }),
              ),
            );
          }
        },
        { maxWait: 10_000, timeout: 30_000 },
      );
    } else if (status === "VOID" && invoice.status !== "DRAFT") {
      // Voiding a SENT/OVERDUE invoice must give the deducted stock back,
      // otherwise inventory counts drift silently. Write one reversing entry
      // per original ledger row. referenceType "invoice_void" keeps this
      // idempotent and distinct from the original "invoice" rows.
      const originals = await prisma.inventoryLedger.findMany({
        where: { referenceType: "invoice", referenceId: id },
      });
      const alreadyReversed = await prisma.inventoryLedger.findFirst({
        where: { referenceType: "invoice_void", referenceId: id },
      });

      const ops: Prisma.PrismaPromise<unknown>[] = [
        prisma.invoice.update({ where: { id }, data }),
      ];
      if (!alreadyReversed) {
        for (const row of originals) {
          ops.push(
            prisma.inventoryLedger.create({
              data: {
                productId: row.productId,
                retailerId: row.retailerId,
                outletId: row.outletId,
                quantityChange: -row.quantityChange,
                movementType: "ADJUSTMENT",
                referenceType: "invoice_void",
                referenceId: id,
                notes: `Reversal — invoice ${invoice.invoiceNumber} voided`,
                createdById: userId,
              },
            }),
          );
        }
      }
      await prisma.$transaction(ops);
    } else {
      await prisma.invoice.update({ where: { id }, data });
    }

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to update invoice status:", err);
    const message =
      err instanceof Error && err.message
        ? err.message.split("\n")[0]
        : "Failed to update invoice status";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Send Invoice (alias)
// ---------------------------------------------------------------------------

export async function sendInvoice(id: string) {
  return updateInvoiceStatus(id, "SENT");
}

// ---------------------------------------------------------------------------
// Active Retailers (for filters)
// ---------------------------------------------------------------------------

const _getActiveRetailers = unstable_cache(
  async () =>
    prisma.retailer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        paymentTerms: true,
        outlets: {
          where: { isActive: true },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ["getActiveRetailers", "invoices"],
  { tags: [CACHE_TAGS.activeRetailers], revalidate: 300 },
);

export async function getActiveRetailers() {
  return _getActiveRetailers();
}

// ---------------------------------------------------------------------------
// Get GST Rate (exposed for the form)
// ---------------------------------------------------------------------------

export async function getGstRateForInvoice(): Promise<number> {
  return getGstRate();
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

// Sets the cumulative amount paid on an invoice. Status is derived:
// fully paid -> PAID (stamps paidAt); anything less on a PAID invoice
// drops it back to SENT and clears paidAt. DRAFT and VOID are rejected.
export async function updateInvoicePayment(
  id: string,
  newAmount: number,
): Promise<ActionResult> {
  if (!Number.isFinite(newAmount) || newAmount < 0) {
    return {
      success: false,
      fieldErrors: { amountPaid: ["Amount must be zero or more"] },
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, total: true },
  });
  if (!invoice) return { success: false, error: "Invoice not found" };
  if (invoice.status === "DRAFT" || invoice.status === "VOID") {
    return {
      success: false,
      error: `Cannot record payments on a ${invoice.status.toLowerCase()} invoice`,
    };
  }

  const total = Number(invoice.total);
  if (newAmount > total) {
    return {
      success: false,
      fieldErrors: { amountPaid: [`Cannot exceed the invoice total (${total.toFixed(2)})`] },
    };
  }

  const fullyPaid = Math.abs(newAmount - total) < 0.005;

  try {
    await prisma.invoice.update({
      where: { id },
      data: {
        amountPaid: newAmount,
        status: fullyPaid ? "PAID" : invoice.status === "PAID" ? "SENT" : invoice.status,
        paidAt: fullyPaid ? new Date() : null,
      },
    });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("Failed to update invoice payment:", err);
    return { success: false, error: errorMessage(err, "Failed to update payment") };
  }
}
