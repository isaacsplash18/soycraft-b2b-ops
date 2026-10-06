import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { NextRequest } from "next/server";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd HH:mm:ss");
}

function num(v: unknown): number {
  return Number(v) || 0;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const dateFrom = fromParam ? new Date(fromParam) : null;
  const dateTo = toParam ? new Date(toParam + "T23:59:59.999Z") : null;

  const wb = XLSX.utils.book_new();

  // ── Tab: Products ──
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const productsData = products.map((p) => ({
    "SKU Code": p.skuCode,
    Name: p.name,
    Category: p.category ?? "",
    MSRP: num(p.msrp),
    "Weight (kg)": num(p.weightKg),
    Barcode: p.barcode ?? "",
    Active: p.isActive ? "Yes" : "No",
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productsData);
  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  // ── Tab: Retailers ──
  const retailers = await prisma.retailer.findMany({
    orderBy: { name: "asc" },
  });
  const retailersData = retailers.map((r) => ({
    Code: r.code,
    Name: r.name,
    Type: r.type,
    "Contact Person": r.contactPerson ?? "",
    Email: r.email,
    Phone: r.phone ?? "",
    Address: r.address ?? "",
    "Payment Terms": r.paymentTerms ?? "",
    Active: r.isActive ? "Yes" : "No",
  }));
  const wsRetailers = XLSX.utils.json_to_sheet(retailersData);
  XLSX.utils.book_append_sheet(wb, wsRetailers, "Retailers");

  // ── Tab: Pricing Matrix ──
  const pricing = await prisma.retailerPricing.findMany({
    where: { effectiveTo: null },
    include: {
      retailer: { select: { name: true } },
      product: {
        select: { skuCode: true, name: true, msrp: true },
      },
    },
    orderBy: [{ retailer: { name: "asc" } }, { product: { skuCode: "asc" } }],
  });
  const pricingData = pricing.map((p) => {
    const msrp = num(p.product.msrp);
    const price = num(p.unitPrice);
    const marginPct = msrp > 0 ? ((msrp - price) / msrp) * 100 : 0;
    return {
      Retailer: p.retailer.name,
      SKU: p.product.skuCode,
      Product: p.product.name,
      "Retailer Price": price,
      MSRP: msrp,
      "Margin %": Math.round(marginPct * 10) / 10,
    };
  });
  const wsPricing = XLSX.utils.json_to_sheet(pricingData);
  XLSX.utils.book_append_sheet(wb, wsPricing, "Pricing Matrix");

  // ── Tab: Inventory - Warehouse ──
  const warehouseStock = await prisma.inventoryLedger.groupBy({
    by: ["productId"],
    where: { retailerId: null },
    _sum: { quantityChange: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseData = warehouseStock
    .map((ws) => {
      const p = productMap.get(ws.productId);
      return {
        SKU: p?.skuCode ?? "",
        Product: p?.name ?? "",
        "Current Stock": ws._sum.quantityChange ?? 0,
      };
    })
    .sort((a, b) => a.SKU.localeCompare(b.SKU));
  const wsWarehouse = XLSX.utils.json_to_sheet(
    warehouseData.length > 0 ? warehouseData : [{ SKU: "", Product: "", "Current Stock": 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsWarehouse, "Inventory - Warehouse");

  // ── Tab: Inventory - By Retailer ──
  const retailerStock = await prisma.inventoryLedger.groupBy({
    by: ["productId", "retailerId"],
    where: { retailerId: { not: null } },
    _sum: { quantityChange: true },
  });
  const retailerMap = new Map(retailers.map((r) => [r.id, r]));
  const retailerStockData = retailerStock
    .map((rs) => {
      const p = productMap.get(rs.productId);
      const r = rs.retailerId ? retailerMap.get(rs.retailerId) : null;
      return {
        Retailer: r?.name ?? "",
        SKU: p?.skuCode ?? "",
        Product: p?.name ?? "",
        "Current Stock": rs._sum.quantityChange ?? 0,
      };
    })
    .sort((a, b) => a.Retailer.localeCompare(b.Retailer) || a.SKU.localeCompare(b.SKU));
  const wsRetailerStock = XLSX.utils.json_to_sheet(
    retailerStockData.length > 0
      ? retailerStockData
      : [{ Retailer: "", SKU: "", Product: "", "Current Stock": 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsRetailerStock, "Inventory - By Retailer");

  // ── Tab: Inventory Ledger ──
  const ledgerWhere: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    ledgerWhere.createdAt = {};
    if (dateFrom) (ledgerWhere.createdAt as Record<string, Date>).gte = dateFrom;
    if (dateTo) (ledgerWhere.createdAt as Record<string, Date>).lte = dateTo;
  }
  const ledger = await prisma.inventoryLedger.findMany({
    where: ledgerWhere,
    include: {
      product: { select: { skuCode: true, name: true } },
      retailer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const ledgerData = ledger.map((l) => ({
    Date: fmtDateTime(l.createdAt),
    SKU: l.product.skuCode,
    Product: l.product.name,
    Retailer: l.retailer?.name ?? "Warehouse",
    "Movement Type": l.movementType,
    Quantity: l.quantityChange,
    "Reference Type": l.referenceType ?? "",
    "Reference ID": l.referenceId ?? "",
    Notes: l.notes ?? "",
  }));
  const wsLedger = XLSX.utils.json_to_sheet(
    ledgerData.length > 0
      ? ledgerData
      : [{ Date: "", SKU: "", Product: "", Retailer: "", "Movement Type": "", Quantity: 0, "Reference Type": "", "Reference ID": "", Notes: "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsLedger, "Inventory Ledger");

  // ── Tab: Delivery Orders ──
  const doWhere: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    doWhere.orderDate = {};
    if (dateFrom) (doWhere.orderDate as Record<string, Date>).gte = dateFrom;
    if (dateTo) (doWhere.orderDate as Record<string, Date>).lte = dateTo;
  }
  const deliveryOrders = await prisma.deliveryOrder.findMany({
    where: doWhere,
    include: {
      retailer: { select: { name: true } },
      outlet: { select: { name: true } },
      lineItems: {
        include: { product: { select: { skuCode: true, name: true } } },
      },
    },
    orderBy: { orderDate: "desc" },
  });
  const doData = deliveryOrders.flatMap((d) =>
    d.lineItems.map((li) => ({
      "DO Number": d.doNumber,
      Status: d.status,
      "Order Date": fmtDate(d.orderDate),
      "Delivery Date": fmtDate(d.deliveryDate),
      Retailer: d.retailer.name,
      Outlet: d.outlet?.name ?? "",
      SKU: li.product.skuCode,
      Product: li.product.name,
      Quantity: li.quantity,
      "Unit Price": num(li.unitPrice),
      "Line Total": num(li.lineTotal),
      Subtotal: num(d.subtotal),
      Notes: d.notes ?? "",
    }))
  );
  const wsDO = XLSX.utils.json_to_sheet(
    doData.length > 0
      ? doData
      : [{ "DO Number": "", Status: "", "Order Date": "", "Delivery Date": "", Retailer: "", Outlet: "", SKU: "", Product: "", Quantity: 0, "Unit Price": 0, "Line Total": 0, Subtotal: 0, Notes: "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsDO, "Delivery Orders");

  // ── Tab: Sell-Through Reports ──
  const stWhere: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    stWhere.reportingMonth = {};
    if (dateFrom) (stWhere.reportingMonth as Record<string, Date>).gte = dateFrom;
    if (dateTo) (stWhere.reportingMonth as Record<string, Date>).lte = dateTo;
  }
  const sellThroughReports = await prisma.sellThroughReport.findMany({
    where: stWhere,
    include: {
      retailer: { select: { name: true } },
      lineItems: {
        include: { product: { select: { skuCode: true, name: true } } },
      },
    },
    orderBy: { reportingMonth: "desc" },
  });
  const stData = sellThroughReports.flatMap((r) =>
    r.lineItems.map((li) => ({
      "Reporting Month": fmtDate(r.reportingMonth),
      Status: r.status,
      Retailer: r.retailer.name,
      "Submitted At": fmtDateTime(r.submittedAt),
      SKU: li.product.skuCode,
      Product: li.product.name,
      "Quantity Sold": li.quantitySold,
      "Unit Price": num(li.unitPrice),
      "Line Total": num(li.lineTotal),
    }))
  );
  const wsST = XLSX.utils.json_to_sheet(
    stData.length > 0
      ? stData
      : [{ "Reporting Month": "", Status: "", Retailer: "", "Submitted At": "", SKU: "", Product: "", "Quantity Sold": 0, "Unit Price": 0, "Line Total": 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsST, "Sell-Through Reports");

  // ── Tab: Invoices ──
  const invWhere: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    invWhere.invoiceDate = {};
    if (dateFrom) (invWhere.invoiceDate as Record<string, Date>).gte = dateFrom;
    if (dateTo) (invWhere.invoiceDate as Record<string, Date>).lte = dateTo;
  }
  const invoices = await prisma.invoice.findMany({
    where: invWhere,
    include: {
      retailer: { select: { name: true } },
      lineItems: {
        include: { product: { select: { skuCode: true, name: true } } },
      },
    },
    orderBy: { invoiceDate: "desc" },
  });
  const invData = invoices.flatMap((inv) =>
    inv.lineItems.map((li) => ({
      "Invoice Number": inv.invoiceNumber,
      Status: inv.status,
      "Invoice Date": fmtDate(inv.invoiceDate),
      "Due Date": fmtDate(inv.dueDate),
      "Billing Month": fmtDate(inv.billingMonth),
      Retailer: inv.retailer.name,
      "Source Type": inv.sourceType ?? "MANUAL",
      SKU: li.product?.skuCode ?? "",
      Product: li.product?.name ?? (li.description ?? ""),
      Quantity: li.quantity,
      "Unit Price": num(li.unitPrice),
      "Line Total": num(li.lineTotal),
      Subtotal: num(inv.subtotal),
      "GST Amount": num(inv.gstAmount),
      Total: num(inv.total),
      "Paid At": fmtDateTime(inv.paidAt),
    }))
  );
  const wsInvoices = XLSX.utils.json_to_sheet(
    invData.length > 0
      ? invData
      : [{ "Invoice Number": "", Status: "", "Invoice Date": "", "Due Date": "", "Billing Month": "", Retailer: "", "Source Type": "", SKU: "", Product: "", Quantity: 0, "Unit Price": 0, "Line Total": 0, Subtotal: 0, "GST Amount": 0, Total: 0, "Paid At": "" }]
  );
  XLSX.utils.book_append_sheet(wb, wsInvoices, "Invoices");

  // ── Tab: Receivables Aging ──
  const now = new Date();
  const outstandingInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] } },
    include: { retailer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
  const agingData = outstandingInvoices.map((inv) => {
    const daysOverdue = Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(inv.dueDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    let bucket = "0-30 Days";
    if (daysOverdue > 90) bucket = "90+ Days";
    else if (daysOverdue > 60) bucket = "61-90 Days";
    else if (daysOverdue > 30) bucket = "31-60 Days";

    return {
      "Invoice Number": inv.invoiceNumber,
      Retailer: inv.retailer.name,
      "Invoice Date": fmtDate(inv.invoiceDate),
      "Due Date": fmtDate(inv.dueDate),
      "Days Overdue": daysOverdue,
      "Aging Bucket": bucket,
      Status: inv.status,
      Total: num(inv.total),
    };
  });
  const wsAging = XLSX.utils.json_to_sheet(
    agingData.length > 0
      ? agingData
      : [{ "Invoice Number": "", Retailer: "", "Invoice Date": "", "Due Date": "", "Days Overdue": 0, "Aging Bucket": "", Status: "", Total: 0 }]
  );
  XLSX.utils.book_append_sheet(wb, wsAging, "Receivables Aging");

  // ── Tab: Metadata ──
  const metaData = [
    { Key: "Export Timestamp", Value: fmtDateTime(now) },
    { Key: "System", Value: "Soycraft B2B" },
    {
      Key: "Date Range",
      Value:
        dateFrom || dateTo
          ? `${dateFrom ? fmtDate(dateFrom) : "All"} to ${dateTo ? fmtDate(dateTo) : "All"}`
          : "All-time",
    },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

  // Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `soycraft-b2b-export-${format(now, "yyyy-MM-dd")}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
