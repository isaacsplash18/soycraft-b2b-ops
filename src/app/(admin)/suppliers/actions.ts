"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { z } from "zod";
import { errorMessage } from "@/lib/action-utils";

const supplierInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Supplier code is required")
    .max(10, "Max 10 characters")
    .transform((v) => v.toUpperCase()),
  contactPerson: z.string().optional(),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  supplierId?: string;
};

export async function getSuppliers(search?: string) {
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { contactPerson: { contains: search, mode: "insensitive" } },
    ];
  }
  return prisma.supplier.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

const _getActiveSuppliers = unstable_cache(
  async () =>
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ["getActiveSuppliers"],
  { tags: [CACHE_TAGS.activeSuppliers], revalidate: 300 },
);

export async function getActiveSuppliers() {
  return _getActiveSuppliers();
}

export async function getSupplier(id: string) {
  return prisma.supplier.findUnique({
    where: { id },
    include: {
      supplierOrders: {
        orderBy: { orderDate: "desc" },
        take: 20,
      },
    },
  });
}

export async function createSupplier(
  data: SupplierInput
): Promise<ActionResult> {
  const parsed = supplierInputSchema.safeParse(data);
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
    const supplier = await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        contactPerson: parsed.data.contactPerson || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });
    revalidatePath("/suppliers");
    revalidateTag(CACHE_TAGS.activeSuppliers, "max");
    return { success: true, supplierId: supplier.id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { code: ["This code is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to create supplier") };
  }
}

export async function updateSupplier(
  id: string,
  data: SupplierInput
): Promise<ActionResult> {
  const parsed = supplierInputSchema.safeParse(data);
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
    await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        contactPerson: parsed.data.contactPerson || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    revalidateTag(CACHE_TAGS.activeSuppliers, "max");
    return { success: true, supplierId: id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { code: ["This code is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to update supplier") };
  }
}

export async function toggleSupplierActive(id: string): Promise<ActionResult> {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return { success: false, error: "Supplier not found" };

    await prisma.supplier.update({
      where: { id },
      data: { isActive: !supplier.isActive },
    });
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    revalidateTag(CACHE_TAGS.activeSuppliers, "max");
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to toggle supplier status") };
  }
}
