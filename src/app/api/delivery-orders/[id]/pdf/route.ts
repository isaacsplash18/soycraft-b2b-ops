import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { DoDocument } from "@/lib/pdf/do-template";
import type { DoPdfData, DoLineItemData } from "@/lib/pdf/do-template";
import { format } from "date-fns";
import { createElement } from "react";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [order, settingsRows] = await Promise.all([
    prisma.deliveryOrder.findUnique({
      where: { id },
      include: {
        retailer: true,
        outlet: { select: { id: true, name: true, code: true, address: true } },
        lineItems: {
          include: {
            product: { select: { skuCode: true, name: true } },
          },
          orderBy: { product: { skuCode: "asc" } },
        },
      },
    }),
    prisma.settings.findMany(),
  ]);

  if (!order) {
    return new Response("Delivery order not found", { status: 404 });
  }

  // Build settings map
  const settings = Object.fromEntries(
    settingsRows.map((s) => [s.key, s.value])
  );

  type OrderLineItem = (typeof order.lineItems)[number];

  const lineItems: DoLineItemData[] = order.lineItems.map((item: OrderLineItem) => ({
    skuCode: item.product.skuCode,
    productName: item.product.name,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    lineTotal: Number(item.lineTotal),
  }));

  const data: DoPdfData = {
    doNumber: order.doNumber,
    orderDate: format(new Date(order.orderDate), "dd MMM yyyy"),
    deliveryDate: order.deliveryDate
      ? format(new Date(order.deliveryDate), "dd MMM yyyy")
      : null,
    retailerName: order.retailer.name,
    retailerAddress: order.retailer.address,
    outletName: order.outlet?.name ?? null,
    outletAddress: order.outlet?.address ?? null,
    sourceReference: order.sourceReference,
    notes: order.notes,
    lineItems,
    subtotal: Number(order.subtotal),
    companyName: settings.company_name || "Soycraft Pte Ltd",
    companyAddress: settings.company_address || "",
    companyUen: settings.company_uen || "",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(DoDocument, { data }) as any
  );

  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.doNumber}.pdf"`,
    },
  });
}
