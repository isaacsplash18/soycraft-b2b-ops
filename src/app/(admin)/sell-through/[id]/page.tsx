import Link from "next/link";
import { notFound } from "next/navigation";
import { getSellThroughReport } from "../actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ReportActions } from "./report-actions";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

const statusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: {
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    label: "Draft",
  },
  SUBMITTED: {
    className:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
    label: "Submitted",
  },
  APPROVED: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Approved",
  },
  INVOICED: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Invoiced",
  },
};

export default async function SellThroughDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getSellThroughReport(id);

  if (!report) notFound();

  const badge = statusBadge[report.status] ?? statusBadge.DRAFT;
  const total = report.lineItems.reduce(
    (sum, li) => sum + Number(li.lineTotal),
    0
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/sell-through" className="hover:text-foreground">
          Sell-Through
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {report.retailer.name} &ndash;{" "}
          {format(new Date(report.reportingMonth), "MMM yyyy")}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {report.retailer.name} &ndash;{" "}
            {format(new Date(report.reportingMonth), "MMMM yyyy")}
          </h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <ReportActions
          reportId={report.id}
          status={report.status}
          retailerId={report.retailerId}
          reportingMonth={report.reportingMonth.toISOString()}
        />
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Retailer</p>
          <p className="font-medium">{report.retailer.name}</p>
        </div>
        {report.outlet && (
          <div>
            <p className="text-xs text-muted-foreground">Outlet</p>
            <p className="font-medium">{report.outlet.name}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Reporting Month</p>
          <p className="font-medium">
            {format(new Date(report.reportingMonth), "MMMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Submitted At</p>
          <p className="font-medium">
            {report.submittedAt
              ? format(new Date(report.submittedAt), "dd MMM yyyy HH:mm")
              : "\u2014"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Approved By</p>
          <p className="font-medium">{report.approvedBy?.name ?? "\u2014"}</p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product.skuCode}
                  </TableCell>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell className="text-right">
                    {item.quantitySold}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatSGD(Number(item.unitPrice))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSGD(Number(item.lineTotal))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="rounded-lg border px-6 py-3">
            <span className="text-sm text-muted-foreground">Total: </span>
            <span className="text-xl font-semibold">{formatSGD(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
