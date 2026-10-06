import Link from "next/link";
import { getSellThroughReports, getConsignmentRetailers } from "./actions";

export const dynamic = "force-dynamic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSelect, FilterInput } from "@/components/ui/filter-controls";
import { format } from "date-fns";
import { ClipboardList, Plus } from "lucide-react";

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

export default async function SellThroughPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { status, retailerId, month } = await searchParams;

  const statusStr = typeof status === "string" ? status : undefined;
  const retailerIdStr =
    typeof retailerId === "string" ? retailerId : undefined;
  const monthStr = typeof month === "string" ? month : undefined;

  const [reports, retailers] = await Promise.all([
    getSellThroughReports({
      status: statusStr,
      retailerId: retailerIdStr,
      month: monthStr,
    }),
    getConsignmentRetailers(),
  ]);

  const hasFilters = statusStr || retailerIdStr || monthStr;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Sell-Through Reports</h1>
        </div>
        <Button asChild>
          <Link href="/sell-through/new">
            <Plus className="size-4" />
            Record Sell-Through
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap items-center gap-3" method="GET">
        <FilterSelect name="status" defaultValue={statusStr ?? ""}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="INVOICED">Invoiced</option>
        </FilterSelect>
        <FilterSelect name="retailerId" defaultValue={retailerIdStr ?? ""}>
          <option value="">All Retailers</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </FilterSelect>
        <FilterInput type="month" name="month" defaultValue={monthStr ?? ""} />
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </noscript>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link href="/sell-through">
              Clear
            </Link>
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Retailer</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No sell-through reports found.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => {
                const badge =
                  statusBadge[report.status] ?? statusBadge.DRAFT;
                return (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.retailer.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {report.outlet?.name ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(report.reportingMonth), "MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.submittedAt
                        ? format(
                            new Date(report.submittedAt),
                            "dd MMM yyyy HH:mm"
                          )
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatSGD(report.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/sell-through/${report.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
