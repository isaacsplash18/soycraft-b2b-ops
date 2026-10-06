"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { errorMessage } from "@/lib/action-utils";

function bustProductCache() {
  revalidateTag(CACHE_TAGS.activeProducts, "max");
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const productInputSchema = z.object({
  skuCode: z.string().min(1, "SKU Code is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
  msrp: z.coerce.number().min(0, "MSRP must be >= 0"),
  weightKg: z.coerce.number().min(0).optional(),
  barcode: z.string().optional(),
  shopifyVariantId: z.string().optional(),
  imageUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  productId?: string;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getProducts(search?: string, category?: string) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { skuCode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) {
    where.category = category;
  }

  return prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      retailerPricing: {
        include: { retailer: true },
        where: {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date() } },
          ],
        },
        orderBy: { effectiveFrom: "desc" },
      },
    },
  });
}

export async function getCategories() {
  const results = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return results
    .map((r: { category: string | null }) => r.category)
    .filter((c: string | null): c is string => c !== null);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createProduct(data: ProductInput): Promise<ActionResult> {
  const parsed = productInputSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const { imageUrl, ...rest } = parsed.data;

  try {
    const product = await prisma.product.create({
      data: {
        ...rest,
        imageUrl: imageUrl || null,
        category: rest.category || null,
        weightKg: rest.weightKg ?? null,
        barcode: rest.barcode || null,
        shopifyVariantId: rest.shopifyVariantId || null,
      },
    });
    revalidatePath("/products");
    bustProductCache();
    return { success: true, productId: product.id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { skuCode: ["This SKU Code is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to create product") };
  }
}

export async function updateProduct(
  id: string,
  data: ProductInput
): Promise<ActionResult> {
  const parsed = productInputSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return { success: false, fieldErrors };
  }

  const { imageUrl, ...rest } = parsed.data;

  try {
    await prisma.product.update({
      where: { id },
      data: {
        ...rest,
        imageUrl: imageUrl || null,
        category: rest.category || null,
        weightKg: rest.weightKg ?? null,
        barcode: rest.barcode || null,
        shopifyVariantId: rest.shopifyVariantId || null,
      },
    });
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    bustProductCache();
    return { success: true, productId: id };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return {
        success: false,
        fieldErrors: { skuCode: ["This SKU Code is already in use"] },
      };
    }
    return { success: false, error: errorMessage(err, "Failed to update product") };
  }
}

export async function toggleProductActive(id: string): Promise<ActionResult> {
  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return { success: false, error: "Product not found" };

    await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    bustProductCache();
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, "Failed to toggle product status") };
  }
}
