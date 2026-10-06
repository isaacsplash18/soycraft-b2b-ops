import Link from "next/link";
import { getSupplierOrders } from "./actions";
import { getActiveSuppliers } from "../suppliers/actions";
import { getCurrentRole } from "@/lib/auth-utils";
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
import { SortableHead, resolveSort } from "@/components/ui/sortable-head";
import { Plus } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, { className: string; label: string }> = {
  ORDERED: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Ordered",
  },
  IN_TRANSIT: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "In Transit",
  },
  DELIVERED: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Delivered",
  },
  CANCELLED: {
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    label: "Cancelled",
  },
};

const paymentBadge: Record<string, { className: string; label: string }> = {
  UNPAID: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Unpaid",
  },
  PARTIALLY_PAID: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Partial",
  },
  PAID: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Paid",
  },
};

const formatSGD = (v: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(v));

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supplierId =
    typeof params.supplierId === "string" ? params.supplierId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const sortStr = typeof params.sort === "string" ? params.sort : undefined;
  const dirStr = typeof params.dir === "string" ? params.dir : undefined;

  // Role is resolved first so staff can't sort by cost (subtotal) via the URL —
  // the column is hidden from them, and ordering by it would leak cost info.
  const role = await getCurrentRole();
  const canSeeCost = role === "admin";

  const sortFields = [
    "soNumber",
    "supplier",
    "orderDate",
    "expectedDeliveryDate",
    "status",
    "subtotal",
    "createdAt",
  ] as const;
  const sorted = resolveSort(
    { sort: sortStr, dir: dirStr },
    canSeeCost ? sortFields : sortFields.filter((f) => f !== "subtotal"),
    { field: "orderDate", dir: "desc" },
  );

  const [orders, suppliers] = await Promise.all([
    getSupplierOrders({
      supplierId,
      status,
      dateFrom,
      dateTo,
      sort: sorted.field,
      dir: sorted.dir,
    }),
    getActiveSuppliers(),
  ]);

  const hasFilters = supplierId || status || dateFrom || dateTo;
  // Passed to sortable headers so sort links preserve the active filters.
  const sp = {
    supplierId,
    status,
    dateFrom,
    dateTo,
    sort: sortStr,
    dir: dirStr,
  };

  type SO = (typeof orders)[number];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Supplier Orders</h1>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/supplier-orders/new">
            <Plus className="size-4" />
            New Supplier Order
          </Link>
        </Button>
      </div>

      {/* Filters — apply on change, no submit button needed */}
      <form className="flex flex-wrap items-end gap-3" method="GET">
        {sortStr && <input type="hidden" name="sort" value={sortStr} />}
        {dirStr && <input type="hidden" name="dir" value={dirStr} />}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Supplier</label>
          <FilterSelect
            name="supplierId"
            defaultValue={supplierId ?? ""}
            className="w-48"
          >
            <option value="">All</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <FilterSelect
            name="status"
            defaultValue={status ?? "ALL"}
            className="w-36"
          >
            <option value="ALL">All</option>
            <option value="ORDERED">Ordered</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </FilterSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <FilterInput
            type="date"
            name="dateFrom"
            defaultValue={dateFrom ?? ""}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <FilterInput
            type="date"
            name="dateTo"
            defaultValue={dateTo ?? ""}
          />
        </div>
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </noscript>
        {hasFilters && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/supplier-orders">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SO Number</TableHead>
              <SortableHead field="supplier" label="Supplier" basePath="/supplier-orders" sp={sp} />
              <SortableHead field="orderDate" label="Order Date" basePath="/supplier-orders" sp={sp} />
              <SortableHead
                field="expectedDeliveryDate"
                label="Expected"
                basePath="/supplier-orders"
                sp={sp}
              />
              <TableHead>Items</TableHead>
              <SortableHead field="status" label="Status" basePath="/supplier-orders" sp={sp} />
              {canSeeCost && <TableHead>Payment</TableHead>}
              {canSeeCost && (
                <SortableHead
                  field="subtotal"
                  label="Subtotal"
                  basePath="/supplier-orders"
                  sp={sp}
                  className="text-right"
                />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canSeeCost ? 8 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No supplier orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((so: SO) => {
                const badge = statusBadge[so.status] ?? statusBadge.ORDERED;
                const pay = paymentBadge[so.paymentStatus] ?? paymentBadge.UNPAID;
                const paid = Number(so.amountPaid);
                const total = Number(so.subtotal);
                return (
                  <TableRow key={so.id}>
                    <TableCell>
                      <Link
                        href={`/supplier-orders/${so.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {so.soNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{so.supplier.name}</TableCell>
                    <TableCell>
                      {format(new Date(so.orderDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {so.expectedDeliveryDate
                        ? format(new Date(so.expectedDeliveryDate), "dd MMM yyyy")
                        : "\u2014"}
                    </TableCell>
                    <TableCell>{so._count.lineItems}</TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    {canSeeCost && (
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge className={pay.className}>{pay.label}</Badge>
                          {so.paymentStatus === "PARTIALLY_PAID" && (
                            <span className="text-xs text-muted-foreground">
                              {formatSGD(paid)} / {formatSGD(total)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {canSeeCost && (
                      <TableCell className="text-right font-medium">
                        {formatSGD(total)}
                      </TableCell>
                    )}
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
