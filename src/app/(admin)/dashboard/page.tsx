export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Package,
  Store,
  Truck,
  ClipboardList,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileWarning,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

async function getDashboardCounts() {
  const [totalProducts, activeRetailers, pendingDOs] =
    await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.retailer.count({ where: { isActive: true } }),
      prisma.deliveryOrder.count({
        where: { status: { in: ["DRAFT", "CONFIRMED"] } },
      }),
    ]);

  return { totalProducts, activeRetailers, pendingDOs };
}

async function getSellThroughNudges() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Before the 6th nobody is late yet, so the two "missing report" queries
  // stay unissued — the rest runs in one round trip.
  const [pendingSellThrough, consignmentRetailers, submittedRetailerIds] =
    await Promise.all([
      prisma.sellThroughReport.count({
        where: { status: "SUBMITTED" },
      }),
      dayOfMonth > 5
        ? prisma.retailer.findMany({
            where: { isActive: true, type: "CONSIGNMENT" },
            select: { id: true, name: true },
          })
        : [],
      dayOfMonth > 5
        ? prisma.sellThroughReport.findMany({
            where: {
              reportingMonth: currentMonthStart,
              status: { in: ["SUBMITTED", "APPROVED", "INVOICED"] },
            },
            select: { retailerId: true },
          })
        : [],
    ]);

  const submittedSet = new Set(submittedRetailerIds.map((r) => r.retailerId));

  const missingRetailers = consignmentRetailers.filter(
    (r) => !submittedSet.has(r.id)
  );

  return { pendingSellThrough, missingRetailers };
}

async function getRevenueData() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // One aggregate per figure, all in a single round trip — the invoice rows
  // themselves were only ever summed, never displayed.
  const [current, previous, buyout, consignment] = await Promise.all([
    // Current month invoices (non-VOID, non-DRAFT)
    prisma.invoice.aggregate({
      where: {
        invoiceDate: { gte: currentMonthStart },
        status: { notIn: ["VOID", "DRAFT"] },
      },
      _sum: { total: true },
    }),
    // Previous month invoices
    prisma.invoice.aggregate({
      where: {
        invoiceDate: { gte: prevMonthStart, lt: currentMonthStart },
        status: { notIn: ["VOID", "DRAFT"] },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        invoiceDate: { gte: currentMonthStart },
        status: { notIn: ["VOID", "DRAFT"] },
        retailer: { type: "BUYOUT" },
      },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: {
        invoiceDate: { gte: currentMonthStart },
        status: { notIn: ["VOID", "DRAFT"] },
        retailer: { type: "CONSIGNMENT" },
      },
      _sum: { total: true },
    }),
  ]);

  return {
    currentTotal: Number(current._sum.total ?? 0),
    prevTotal: Number(previous._sum.total ?? 0),
    buyoutRevenue: Number(buyout._sum.total ?? 0),
    consignmentRevenue: Number(consignment._sum.total ?? 0),
  };
}

async function getOverdueInvoices() {
  const now = new Date();
  // Count and total come straight from the DB — the rows were only reduced.
  const overdue = await prisma.invoice.aggregate({
    where: {
      OR: [
        { status: "OVERDUE" },
        { status: "SENT", dueDate: { lt: now } },
      ],
    },
    _count: true,
    _sum: { total: true },
  });

  return {
    count: overdue._count,
    totalAmount: Number(overdue._sum.total ?? 0),
  };
}

// Weeks of stock left per SKU: warehouse on-hand divided by the average
// weekly sell-through over the last 90 days, with inbound supplier-order
// quantities shown alongside. Only SKUs that are actually selling appear.
async function getStockRunway() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [warehouse, sellThrough, inbound, products] = await Promise.all([
    prisma.inventoryLedger.groupBy({
      by: ["productId"],
      where: { retailerId: null },
      _sum: { quantityChange: true },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["productId"],
      where: { movementType: "SELL_THROUGH", createdAt: { gte: ninetyDaysAgo } },
      _sum: { quantityChange: true },
    }),
    prisma.supplierOrderLineItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        supplierOrder: { status: { in: ["ORDERED", "IN_TRANSIT"] } },
      },
      _sum: { orderedQty: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, skuCode: true, name: true },
    }),
  ]);

  const stockMap = new Map(
    warehouse.map((r) => [r.productId, r._sum.quantityChange ?? 0]),
  );
  const inboundMap = new Map(
    inbound.map((r) => [r.productId as string, r._sum.orderedQty ?? 0]),
  );
  const productMap = new Map(products.map((p) => [p.id, p]));

  const rows = [];
  for (const r of sellThrough) {
    const weeklyRate = Math.abs(r._sum.quantityChange ?? 0) / (90 / 7);
    if (weeklyRate <= 0) continue;
    const product = productMap.get(r.productId);
    if (!product) continue;
    const stock = stockMap.get(r.productId) ?? 0;
    rows.push({
      skuCode: product.skuCode,
      name: product.name,
      stock,
      weeklyRate,
      weeks: stock > 0 ? stock / weeklyRate : 0,
      inbound: inboundMap.get(r.productId) ?? 0,
    });
  }

  rows.sort((a, b) => a.weeks - b.weeks);
  return rows.slice(0, 6);
}

async function getRecentActivity() {
  const [recentDOs, recentInvoices] = await Promise.all([
    prisma.deliveryOrder.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        doNumber: true,
        orderDate: true,
        status: true,
        retailer: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        retailer: { select: { name: true } },
      },
    }),
  ]);

  return { recentDOs, recentInvoices };
}

// One neutral icon treatment for every stat card — color is reserved for
// signaling something (overdue, low stock), never used decoratively.
const statIconBadge = "rounded-lg bg-muted p-2";
const statIconClass = "h-4 w-4 text-muted-foreground";
const statLabelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const statNumberClass = "text-2xl font-semibold tabular-nums";

const summaryCards = [
  { label: "Total Products", key: "totalProducts" as const, icon: Package },
  { label: "Active Retailers", key: "activeRetailers" as const, icon: Store },
  { label: "Pending DOs", key: "pendingDOs" as const, icon: Truck },
];

const doStatusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: { className: "bg-gray-100 text-gray-600", label: "Draft" },
  CONFIRMED: { className: "bg-blue-100 text-blue-700", label: "Confirmed" },
  DELIVERED: { className: "bg-emerald-100 text-emerald-700", label: "Delivered" },
  CANCELLED: { className: "bg-red-100 text-red-700", label: "Cancelled" },
};

const invoiceStatusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: { className: "bg-gray-100 text-gray-600", label: "Draft" },
  SENT: { className: "bg-blue-100 text-blue-700", label: "Sent" },
  PAID: { className: "bg-emerald-100 text-emerald-700", label: "Paid" },
  OVERDUE: { className: "bg-red-100 text-red-700", label: "Overdue" },
  VOID: { className: "bg-gray-100 text-gray-400", label: "Void" },
};

export default async function DashboardPage() {
  const [counts, sellThrough, revenue, overdue, activity, runway] =
    await Promise.all([
      getDashboardCounts(),
      getSellThroughNudges(),
      getRevenueData(),
      getOverdueInvoices(),
      getRecentActivity(),
      getStockRunway(),
    ]);

  const revenueChange =
    revenue.prevTotal > 0
      ? ((revenue.currentTotal - revenue.prevTotal) / revenue.prevTotal) * 100
      : revenue.currentTotal > 0
        ? 100
        : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {format(new Date(), "EEEE, dd MMMM yyyy")}
        </p>
      </div>

      {/* Top summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className={statLabelClass}>{card.label}</CardTitle>
                <div className={statIconBadge}>
                  <Icon className={statIconClass} />
                </div>
              </CardHeader>
              <CardContent>
                <p className={statNumberClass}>{counts[card.key]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue & Overdue row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Revenue This Month */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={statLabelClass}>Revenue This Month</CardTitle>
            <div className={statIconBadge}>
              <DollarSign className={statIconClass} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={statNumberClass}>{formatSGD(revenue.currentTotal)}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              {revenueChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={
                  revenueChange >= 0 ? "text-emerald-600" : "text-red-600"
                }
              >
                {revenueChange >= 0 ? "+" : ""}
                {revenueChange.toFixed(1)}% vs last month
              </span>
              <span className="text-muted-foreground">
                ({formatSGD(revenue.prevTotal)})
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
              <div>
                <p className={statLabelClass}>Buy-out</p>
                <p className="text-lg font-medium tabular-nums">
                  {formatSGD(revenue.buyoutRevenue)}
                </p>
              </div>
              <div>
                <p className={statLabelClass}>Consignment</p>
                <p className="text-lg font-medium tabular-nums">
                  {formatSGD(revenue.consignmentRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={statLabelClass}>Overdue Invoices</CardTitle>
            <div className={statIconBadge}>
              <FileWarning className={statIconClass} />
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`${statNumberClass} ${
                overdue.count > 0 ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {overdue.count}
            </p>
            {overdue.count > 0 && (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total: {formatSGD(overdue.totalAmount)}
                </p>
                <Link
                  href="/invoices?status=OVERDUE"
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                >
                  View overdue &rarr;
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sell-Through Nudges */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Pending Sell-Through */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={statLabelClass}>Pending Sell-Through</CardTitle>
            <div className={statIconBadge}>
              <ClipboardList className={statIconClass} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={statNumberClass}>
              {sellThrough.pendingSellThrough}
            </p>
            {sellThrough.pendingSellThrough > 0 && (
              <Link
                href="/sell-through?status=SUBMITTED"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Review reports &rarr;
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Missing Reports */}
        {sellThrough.missingRetailers.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={statLabelClass}>
                Missing Reports This Month
              </CardTitle>
              <div className={statIconBadge}>
                <Clock className={statIconClass} />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`${statNumberClass} mb-2 text-amber-600 dark:text-amber-400`}>
                {sellThrough.missingRetailers.length}
              </p>
              <ul className="space-y-1">
                {sellThrough.missingRetailers.map((r) => (
                  <li
                    key={r.id}
                    className="text-sm text-muted-foreground"
                  >
                    {r.name}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stock Runway */}
      {runway.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Runway
              <span className="ml-2 font-normal">
                — weeks of stock left at the current sell-through rate (90-day avg)
              </span>
            </CardTitle>
            <div className={statIconBadge}>
              <Package className={statIconClass} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {runway.map((r) => {
                const critical = r.weeks < 3;
                const warning = r.weeks < 6;
                return (
                  <div
                    key={r.skuCode}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.skuCode}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.stock} on hand · ~{r.weeklyRate.toFixed(1)}/wk
                        {r.inbound > 0 && (
                          <span className="text-emerald-600"> · +{r.inbound} inbound</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        critical
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : warning
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}
                    >
                      {r.stock <= 0 ? "Out" : `${r.weeks.toFixed(1)} wk`}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Delivery Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Delivery Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.recentDOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivery orders yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.recentDOs.map((d) => {
                  const badge = doStatusBadge[d.status] ?? {
                    className: "bg-gray-100 text-gray-600",
                    label: d.status,
                  };
                  return (
                    <Link
                      key={d.id}
                      href={`/delivery-orders/${d.id}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {d.doNumber}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.retailer.name} &middot;{" "}
                          {format(new Date(d.orderDate), "dd MMM yyyy")}
                        </p>
                      </div>
                      <Badge
                        className={`${badge.className} shrink-0 ml-2`}
                      >
                        {badge.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.recentInvoices.map((inv) => {
                  const badge = invoiceStatusBadge[inv.status] ?? {
                    className: "bg-gray-100 text-gray-600",
                    label: inv.status,
                  };
                  return (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inv.retailer.name} &middot;{" "}
                          {formatSGD(Number(inv.total))}
                        </p>
                      </div>
                      <Badge
                        className={`${badge.className} shrink-0 ml-2`}
                      >
                        {badge.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
