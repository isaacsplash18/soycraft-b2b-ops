export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthSelector } from "./month-selector";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

function getMonthRange(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

async function getReportData(monthStr: string) {
  const { start, end } = getMonthRange(monthStr);
  const now = new Date();

  // Everything below is independent of everything else, so it all goes out
  // in one round trip.
  const [invoices, outstandingInvoices, deliveredDOs, retailers] =
    await Promise.all([
      // Invoices for the selected month
      prisma.invoice.findMany({
        where: {
          invoiceDate: { gte: start, lt: end },
          status: { notIn: ["VOID", "DRAFT"] },
        },
        select: {
          total: true,
          status: true,
          retailer: { select: { id: true, name: true, type: true } },
        },
      }),
      // Outstanding receivables (all unpaid non-void invoices, not just this month)
      prisma.invoice.findMany({
        where: {
          status: { in: ["SENT", "OVERDUE"] },
        },
        select: { total: true, dueDate: true },
      }),
      // Units moved (DOs delivered this month)
      prisma.deliveryOrder.findMany({
        where: {
          deliveryDate: { gte: start, lt: end },
          status: "DELIVERED",
        },
        select: {
          lineItems: {
            select: {
              productId: true,
              quantity: true,
              product: { select: { skuCode: true, name: true } },
            },
          },
        },
      }),
      // Margin analysis: retailer + avg margin from pricing
      prisma.retailer.findMany({
        where: { isActive: true },
        select: {
          name: true,
          pricing: {
            where: { effectiveTo: null },
            select: {
              unitPrice: true,
              product: { select: { msrp: true } },
            },
          },
        },
      }),
    ]);

  const totalRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const buyoutRevenue = invoices
    .filter((i) => i.retailer.type === "BUYOUT")
    .reduce((s, i) => s + Number(i.total), 0);
  const consignmentRevenue = invoices
    .filter((i) => i.retailer.type === "CONSIGNMENT")
    .reduce((s, i) => s + Number(i.total), 0);

  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const paidTotal = paidInvoices.reduce((s, i) => s + Number(i.total), 0);

  const outstandingTotal = outstandingInvoices.reduce(
    (s, i) => s + Number(i.total),
    0
  );

  const totalUnits = deliveredDOs.reduce(
    (s, d) => s + d.lineItems.reduce((ls, li) => ls + li.quantity, 0),
    0
  );

  // Revenue by retailer
  const retailerRevMap = new Map<
    string,
    {
      name: string;
      type: string;
      invoiced: number;
      paid: number;
      outstanding: number;
    }
  >();
  for (const inv of invoices) {
    const existing = retailerRevMap.get(inv.retailer.id) ?? {
      name: inv.retailer.name,
      type: inv.retailer.type,
      invoiced: 0,
      paid: 0,
      outstanding: 0,
    };
    existing.invoiced += Number(inv.total);
    if (inv.status === "PAID") {
      existing.paid += Number(inv.total);
    } else {
      existing.outstanding += Number(inv.total);
    }
    retailerRevMap.set(inv.retailer.id, existing);
  }
  const revenueByRetailer = Array.from(retailerRevMap.values()).sort(
    (a, b) => b.invoiced - a.invoiced
  );

  // Units by SKU
  const skuMap = new Map<string, { name: string; sku: string; units: number }>();
  for (const d of deliveredDOs) {
    for (const li of d.lineItems) {
      const existing = skuMap.get(li.productId) ?? {
        name: li.product.name,
        sku: li.product.skuCode,
        units: 0,
      };
      existing.units += li.quantity;
      skuMap.set(li.productId, existing);
    }
  }
  const unitsBySku = Array.from(skuMap.values()).sort(
    (a, b) => b.units - a.units
  );

  const marginAnalysis = retailers
    .filter((r) => r.pricing.length > 0)
    .map((r) => {
      const margins = r.pricing.map((p) => {
        const msrp = Number(p.product.msrp);
        const price = Number(p.unitPrice);
        return msrp > 0 ? ((msrp - price) / msrp) * 100 : 0;
      });
      const avgMargin =
        margins.length > 0
          ? margins.reduce((s, m) => s + m, 0) / margins.length
          : 0;
      return { name: r.name, avgMargin, skuCount: r.pricing.length };
    })
    .sort((a, b) => b.avgMargin - a.avgMargin);

  // Receivables aging
  const agingBuckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const agingCounts = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const inv of outstandingInvoices) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const amount = Number(inv.total);
    if (daysOverdue <= 30) {
      agingBuckets["0-30"] += amount;
      agingCounts["0-30"]++;
    } else if (daysOverdue <= 60) {
      agingBuckets["31-60"] += amount;
      agingCounts["31-60"]++;
    } else if (daysOverdue <= 90) {
      agingBuckets["61-90"] += amount;
      agingCounts["61-90"]++;
    } else {
      agingBuckets["90+"] += amount;
      agingCounts["90+"]++;
    }
  }

  return {
    totalRevenue,
    buyoutRevenue,
    consignmentRevenue,
    totalUnits,
    outstandingTotal,
    revenueByRetailer,
    unitsBySku,
    marginAnalysis,
    agingBuckets,
    agingCounts,
  };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = params.month || defaultMonth;
  const data = await getReportData(month);

  const marginColor = (m: number) => {
    if (m >= 40) return "text-emerald-600";
    if (m >= 25) return "text-pink-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">Monthly Report</h1>
        </div>
        <MonthSelector currentMonth={month} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatSGD(data.totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Buy-out / Consignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              {formatSGD(data.buyoutRevenue)}{" "}
              <span className="text-muted-foreground font-normal text-sm">/</span>{" "}
              {formatSGD(data.consignmentRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Units Moved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.totalUnits.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatSGD(data.outstandingTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Retailer */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Retailer</CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenueByRetailer.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoice data for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenueByRetailer.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.type === "BUYOUT"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {r.type === "BUYOUT" ? "Buy-out" : "Consignment"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatSGD(r.invoiced)}</TableCell>
                      <TableCell className="text-right">{formatSGD(r.paid)}</TableCell>
                      <TableCell className="text-right">
                        {r.outstanding > 0 ? (
                          <span className="text-red-600">{formatSGD(r.outstanding)}</span>
                        ) : (
                          formatSGD(0)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Units by SKU */}
      <Card>
        <CardHeader>
          <CardTitle>Units by SKU</CardTitle>
        </CardHeader>
        <CardContent>
          {data.unitsBySku.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delivered orders for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Total Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.unitsBySku.map((s) => (
                    <TableRow key={s.sku}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.sku}</TableCell>
                      <TableCell className="text-right">{s.units.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Margin Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {data.marginAnalysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pricing data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead className="text-right">Active SKUs</TableHead>
                    <TableHead className="text-right">Avg Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.marginAnalysis.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.skuCount}</TableCell>
                      <TableCell className={`text-right font-semibold ${marginColor(r.avgMargin)}`}>
                        {r.avgMargin.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receivables Aging */}
      <Card>
        <CardHeader>
          <CardTitle>Receivables Aging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                { label: "0-30 Days", key: "0-30" as const, color: "bg-emerald-50 border-emerald-200" },
                { label: "31-60 Days", key: "31-60" as const, color: "bg-pink-50 border-pink-200" },
                { label: "61-90 Days", key: "61-90" as const, color: "bg-pink-50 border-pink-200" },
                { label: "90+ Days", key: "90+" as const, color: "bg-red-50 border-red-200" },
              ] as const
            ).map((bucket) => (
              <div
                key={bucket.key}
                className={`rounded-lg border p-4 ${bucket.color}`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {bucket.label}
                </p>
                <p className="text-lg font-bold mt-1">
                  {formatSGD(data.agingBuckets[bucket.key])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.agingCounts[bucket.key]} invoice
                  {data.agingCounts[bucket.key] !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
