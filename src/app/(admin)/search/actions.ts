"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentRole } from "@/lib/auth-utils";

export type SearchResult = {
  type: "invoice" | "delivery-order" | "supplier-order" | "retailer" | "supplier" | "product";
  label: string;
  sublabel?: string;
  href: string;
};

// One search box across every entity the app knows about. Each source is
// capped so the dropdown stays scannable; matching is case-insensitive
// substring on the human-readable identifiers.
export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const role = await getCurrentRole();
  if (!role) return [];

  const take = 5;
  const contains = { contains: q, mode: "insensitive" as const };

  const [invoices, dos, sos, retailers, suppliers, products] = await Promise.all([
    prisma.invoice.findMany({
      where: { invoiceNumber: contains },
      select: { id: true, invoiceNumber: true, retailer: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliveryOrder.findMany({
      where: { doNumber: contains },
      select: { id: true, doNumber: true, retailer: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplierOrder.findMany({
      where: { soNumber: contains },
      select: { id: true, soNumber: true, supplier: { select: { name: true } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.retailer.findMany({
      where: { OR: [{ name: contains }, { code: contains }] },
      select: { id: true, name: true, code: true },
      take,
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { OR: [{ name: contains }, { code: contains }] },
      select: { id: true, name: true, code: true },
      take,
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { OR: [{ skuCode: contains }, { name: contains }] },
      select: { id: true, skuCode: true, name: true },
      take,
      orderBy: { skuCode: "asc" },
    }),
  ]);

  const results: SearchResult[] = [
    ...invoices.map((r) => ({
      type: "invoice" as const,
      label: r.invoiceNumber,
      sublabel: r.retailer.name,
      href: `/invoices/${r.id}`,
    })),
    ...dos.map((r) => ({
      type: "delivery-order" as const,
      label: r.doNumber,
      sublabel: r.retailer.name,
      href: `/delivery-orders/${r.id}`,
    })),
    ...sos.map((r) => ({
      type: "supplier-order" as const,
      label: r.soNumber,
      sublabel: r.supplier.name,
      href: `/supplier-orders/${r.id}`,
    })),
    ...retailers.map((r) => ({
      type: "retailer" as const,
      label: r.name,
      sublabel: r.code,
      href: `/retailers/${r.id}`,
    })),
    ...suppliers.map((r) => ({
      type: "supplier" as const,
      label: r.name,
      sublabel: r.code,
      href: `/suppliers/${r.id}`,
    })),
    ...products.map((r) => ({
      type: "product" as const,
      label: r.skuCode,
      sublabel: r.name,
      href: `/products/${r.id}`,
    })),
  ];

  return results.slice(0, 15);
}
