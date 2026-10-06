"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/lib/auth-utils";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { errorMessage } from "@/lib/action-utils";

const _getOtherSubCategoriesCached = unstable_cache(
  async () =>
    prisma.otherSubCategory.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ["getOtherSubCategories"],
  { tags: [CACHE_TAGS.financeCategories], revalidate: 600 },
);

// Shared admin guard used by every Finance action. Middleware already blocks
// Finance pages + /api/finance for non-admin roles, but server actions are
// callable from anywhere authenticated, so we guard here too (defence in depth).
async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Forbidden" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  category: z.enum(["INVENTORY", "EVENT", "OTHER"]),
  entryDate: z.coerce.date(),
  amount: z.coerce.number().min(0),
  description: z.string().optional(),
  notes: z.string().optional(),

  supplierId: z.string().optional().nullable(),
  supplierOrderId: z.string().optional().nullable(),

  eventName: z.string().optional().nullable(),
  eventSubCategory: z
    .enum(["BOOTH_FEE", "LOGISTICS", "TRAVEL", "MARKETING", "OTHER"])
    .optional()
    .nullable(),

  otherSubCategoryId: z.string().optional().nullable(),
});

export type FinanceEntryInput = z.infer<typeof baseSchema>;

const updateSchema = baseSchema.extend({ id: z.string().min(1) });
export type UpdateFinanceEntryInput = z.infer<typeof updateSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  entryId?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getFinanceEntries(filters?: {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}) {
  if (!(await isAdmin())) throw new Error("Forbidden");
  const where: Record<string, unknown> = {};
  if (filters?.category && filters.category !== "ALL") {
    where.category = filters.category;
  }
  if (filters?.dateFrom || filters?.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
    if (filters.dateTo) range.lte = new Date(filters.dateTo);
    where.entryDate = range;
  }
  if (filters?.search) {
    where.OR = [
      { description: { contains: filters.search, mode: "insensitive" } },
      { eventName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return prisma.financeEntry.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      supplierOrder: { select: { id: true, soNumber: true } },
      otherSubCategory: { select: { id: true, name: true } },
    },
    orderBy: { entryDate: "desc" },
  });
}

export async function getFinanceEntry(id: string) {
  if (!(await isAdmin())) throw new Error("Forbidden");
  return prisma.financeEntry.findUnique({
    where: { id },
    include: {
      supplier: true,
      supplierOrder: { select: { id: true, soNumber: true } },
      otherSubCategory: true,
    },
  });
}

export async function getFinanceSummary(filters?: {
  dateFrom?: string;
  dateTo?: string;
}) {
  if (!(await isAdmin())) throw new Error("Forbidden");
  const where: Record<string, unknown> = {};
  if (filters?.dateFrom || filters?.dateTo) {
    const range: Record<string, Date> = {};
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
    if (filters.dateTo) range.lte = new Date(filters.dateTo);
    where.entryDate = range;
  }

  const grouped = await prisma.financeEntry.groupBy({
    by: ["category"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const totals = {
    INVENTORY: 0,
    EVENT: 0,
    OTHER: 0,
    inventoryCount: 0,
    eventCount: 0,
    otherCount: 0,
    grand: 0,
  };

  for (const row of grouped) {
    const sum = Number(row._sum.amount ?? 0);
    if (row.category === "INVENTORY") {
      totals.INVENTORY = sum;
      totals.inventoryCount = row._count._all;
    } else if (row.category === "EVENT") {
      totals.EVENT = sum;
      totals.eventCount = row._count._all;
    } else if (row.category === "OTHER") {
      totals.OTHER = sum;
      totals.otherCount = row._count._all;
    }
    totals.grand += sum;
  }

  return totals;
}

export async function getMonthlyTotals(monthsBack = 6) {
  if (!(await isAdmin())) throw new Error("Forbidden");
  const start = new Date();
  start.setDate(1);
  start.setMonth(start.getMonth() - (monthsBack - 1));
  start.setHours(0, 0, 0, 0);

  const entries = await prisma.financeEntry.findMany({
    where: { entryDate: { gte: start } },
    select: { entryDate: true, amount: true, category: true },
  });

  const buckets: Record<
    string,
    { month: string; INVENTORY: number; EVENT: number; OTHER: number; total: number }
  > = {};

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start);
    d.setMonth(start.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = { month: key, INVENTORY: 0, EVENT: 0, OTHER: 0, total: 0 };
  }

  for (const e of entries) {
    const d = new Date(e.entryDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets[key]) continue;
    const amt = Number(e.amount);
    buckets[key][e.category as "INVENTORY" | "EVENT" | "OTHER"] += amt;
    buckets[key].total += amt;
  }

  return Object.values(buckets);
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

export async function getSuppliersForPicker() {
  if (!(await isAdmin())) throw new Error("Forbidden");
  return prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getOtherSubCategories() {
  if (!(await isAdmin())) throw new Error("Forbidden");
  return _getOtherSubCategoriesCached();
}

export async function createOtherSubCategory(name: string): Promise<{
  success: boolean;
  error?: string;
  id?: string;
}> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Name is required" };
  try {
    const c = await prisma.otherSubCategory.create({
      data: { name: trimmed },
      select: { id: true },
    });
    revalidatePath("/finance");
    revalidateTag(CACHE_TAGS.financeCategories, "max");
    return { success: true, id: c.id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { success: false, error: "This name already exists" };
    }
    return { success: false, error: errorMessage(err, "Failed to create category") };
  }
}

export async function deleteOtherSubCategory(id: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    // Soft delete: deactivate so historical entries still resolve
    await prisma.otherSubCategory.update({
      where: { id },
      data: { isActive: false },
    });
    revalidatePath("/finance");
    revalidateTag(CACHE_TAGS.financeCategories, "max");
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to delete") };
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function normalize(data: FinanceEntryInput) {
  // Strip fields that don't apply to the chosen category
  const out: FinanceEntryInput = { ...data };
  if (data.category !== "INVENTORY") {
    out.supplierId = null;
    out.supplierOrderId = null;
  }
  if (data.category !== "EVENT") {
    out.eventName = null;
    out.eventSubCategory = null;
  }
  if (data.category !== "OTHER") {
    out.otherSubCategoryId = null;
  }
  return out;
}

export async function createFinanceEntry(
  data: FinanceEntryInput
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  const parsed = baseSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const d = normalize(parsed.data);

  try {
    const entry = await prisma.financeEntry.create({
      data: {
        category: d.category,
        entryDate: d.entryDate,
        amount: d.amount,
        description: d.description || null,
        notes: d.notes || null,
        supplierId: d.supplierId || null,
        supplierOrderId: d.supplierOrderId || null,
        eventName: d.eventName || null,
        eventSubCategory: d.eventSubCategory ?? null,
        otherSubCategoryId: d.otherSubCategoryId || null,
      },
      select: { id: true },
    });
    revalidatePath("/finance");
    revalidatePath("/finance/entries");
    return { success: true, entryId: entry.id };
  } catch (err) {
    console.error("Failed to create finance entry:", err);
    return { success: false, error: errorMessage(err, "Failed to create finance entry") };
  }
}

export async function updateFinanceEntry(
  data: UpdateFinanceEntryInput
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
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

  const { id, ...rest } = parsed.data;
  const d = normalize(rest);

  try {
    await prisma.financeEntry.update({
      where: { id },
      data: {
        category: d.category,
        entryDate: d.entryDate,
        amount: d.amount,
        description: d.description || null,
        notes: d.notes || null,
        supplierId: d.supplierId || null,
        supplierOrderId: d.supplierOrderId || null,
        eventName: d.eventName || null,
        eventSubCategory: d.eventSubCategory ?? null,
        otherSubCategoryId: d.otherSubCategoryId || null,
      },
    });
    revalidatePath("/finance");
    revalidatePath("/finance/entries");
    revalidatePath(`/finance/entries/${id}`);
    return { success: true, entryId: id };
  } catch (err) {
    console.error("Failed to update finance entry:", err);
    return { success: false, error: errorMessage(err, "Failed to update finance entry") };
  }
}

export async function deleteFinanceEntry(id: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await prisma.financeEntry.delete({ where: { id } });
    revalidatePath("/finance");
    revalidatePath("/finance/entries");
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to delete entry") };
  }
}
