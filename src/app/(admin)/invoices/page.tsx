import Link from "next/link";
import { getInvoices, getActiveRetailers } from "./actions";

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
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { FilterSelect, FilterInput } from "@/components/ui/filter-controls";
import { SortableHead, resolveSort } from "@/components/ui/sortable-head";
import { FileText, Plus } from "lucide-react";
import { format } from "date-fns";

type Invoice = Awaited<ReturnType<typeof getInvoices>>[number];

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

// Past-due highlighting is computed from dueDate so it works even before the
// daily cron flips the status to OVERDUE.
const isPastDue = (invoice: { status: string; dueDate: Date | string }) =>
  (invoice.status === "SENT" || invoice.status === "OVERDUE") &&
  new Date(invoice.dueDate) < new Date();

const statusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: {
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    label: "Draft",
  },
  SENT: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Sent",
  },
  PAID: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Paid",
  },
  OVERDUE: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Overdue",
  },
  VOID: {
    className:
      "bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500",
    label: "Void",
  },
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { status, retailerId, month, sort, dir } = await searchParams;

  const statusStr = typeof status === "string" ? status : undefined;
  const retailerIdStr = typeof retailerId === "string" ? retailerId : undefined;
  const monthStr = typeof month === "string" ? month : undefined;
  const sortStr = typeof sort === "string" ? sort : undefined;
  const dirStr = typeof dir === "string" ? dir : undefined;

  const sorted = resolveSort(
    { sort: sortStr, dir: dirStr },
    ["invoiceDate", "dueDate", "total", "status", "retailer", "createdAt"] as const,
    { field: "createdAt", dir: "desc" },
  );

  const [invoices, retailers] = await Promise.all([
    getInvoices({
      status: statusStr,
      retailerId: retailerIdStr,
      month: monthStr,
      sort: sorted.field,
      dir: sorted.dir,
    }),
    getActiveRetailers(),
  ]);

  const hasFilters = statusStr || retailerIdStr || monthStr;
  // Passed to sortable headers so sort links preserve the active filters.
  const sp = {
    status: statusStr,
    retailerId: retailerIdStr,
    month: monthStr,
    sort: sortStr,
    dir: dirStr,
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            {hasFilters ? " matching filters" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/generate">
            <Plus className="size-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      {/* Filters — apply on change, no submit button needed */}
      <form className="flex flex-wrap items-center gap-3" method="GET">
        {sortStr && <input type="hidden" name="sort" value={sortStr} />}
        {dirStr && <input type="hidden" name="dir" value={dirStr} />}
        <FilterSelect name="status" defaultValue={statusStr ?? ""}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="VOID">Void</option>
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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/invoices">Clear</Link>
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <SortableHead field="retailer" label="Retailer" basePath="/invoices" sp={sp} />
              <SortableHead field="invoiceDate" label="Date" basePath="/invoices" sp={sp} />
              <SortableHead field="dueDate" label="Due Date" basePath="/invoices" sp={sp} />
              <SortableHead field="status" label="Status" basePath="/invoices" sp={sp} />
              <SortableHead
                field="total"
                label="Total (incl GST)"
                basePath="/invoices"
                sp={sp}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="hover:bg-transparent">
                  <EmptyState
                    icon={FileText}
                    title={hasFilters ? "No matching invoices" : "No invoices yet"}
                    description={
                      hasFilters
                        ? "Try clearing your filters."
                        : "Create your first invoice to get started."
                    }
                    action={
                      !hasFilters && (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/invoices/generate">
                            <Plus className="size-3.5" />
                            New Invoice
                          </Link>
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice: Invoice) => {
                const badge = statusBadge[invoice.status] ?? statusBadge.DRAFT;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.retailer.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell
                      className={`tabular-nums ${
                        isPastDue(invoice)
                          ? "font-medium text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatSGD(Number(invoice.total))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </PageTransition>
  );
}
