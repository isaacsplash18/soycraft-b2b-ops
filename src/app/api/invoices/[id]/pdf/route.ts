import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "@/lib/pdf/invoice-template";
import type { InvoicePdfData, InvoiceLineItemData } from "@/lib/pdf/invoice-template";
import { format } from "date-fns";
import { createElement } from "react";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      retailer: true,
      outlet: { select: { name: true } },
      lineItems: {
        include: {
          product: { select: { skuCode: true, name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  // Fetch company settings
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          "company_name",
          "company_address",
          "company_uen",
          "company_gst_reg",
          "company_bank_details",
        ],
      },
    },
  });

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

  type InvoiceLineItem = (typeof invoice.lineItems)[number];

  const lineItems: InvoiceLineItemData[] = invoice.lineItems.map(
    (item: InvoiceLineItem) => {
      const isAdHoc = item.productId === null;

      return {
        skuCode: isAdHoc ? null : (item.product?.skuCode ?? null),
        productName: isAdHoc ? null : (item.product?.name ?? null),
        description: item.description,
        isAdHoc,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      };
    }
  );

  const data: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: format(new Date(invoice.invoiceDate), "dd MMM yyyy"),
    dueDate: format(new Date(invoice.dueDate), "dd MMM yyyy"),
    billingMonth: format(new Date(invoice.billingMonth), "MMM yyyy"),
    sourceReference: invoice.sourceReference ?? null,
    status: invoice.status,
    retailerName: invoice.retailer.name,
    retailerAddress: invoice.retailer.address,
    retailerContact: invoice.retailer.contactPerson,
    retailerEmail: invoice.retailer.email,
    outletName: invoice.outlet?.name ?? null,
    companyName: settingsMap.get("company_name") ?? "Soycraft Pte Ltd",
    companyAddress:
      settingsMap.get("company_address") ?? "[Address placeholder]",
    companyUen: settingsMap.get("company_uen") ?? "[UEN placeholder]",
    companyGstReg: settingsMap.get("company_gst_reg") ?? "",
    lineItems,
    subtotal: Number(invoice.subtotal),
    gstRate: Number(invoice.gstRate),
    gstAmount: Number(invoice.gstAmount),
    total: Number(invoice.total),
    bankDetails: settingsMap.get("company_bank_details") ?? null,
    paidAt: invoice.paidAt
      ? format(new Date(invoice.paidAt), "dd MMM yyyy")
      : null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    createElement(InvoiceDocument, { data }) as any
  );

  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
