import Link from "next/link";
import { getDeliveryOrders, getActiveRetailers } from "./actions";

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
import { FilterSelect, FilterSearch } from "@/components/ui/filter-controls";
import { SortableHead, resolveSort } from "@/components/ui/sortable-head";
import { PackageCheck, Plus } from "lucide-react";
import { format } from "date-fns";

type DeliveryOrder = Awaited<ReturnType<typeof getDeliveryOrders>>[number];

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
  CONFIRMED: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Confirmed",
  },
  DELIVERED: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Delivered",
  },
  CANCELLED: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Cancelled",
  },
};

export default async function DeliveryOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { status, retailerId, search, sort, dir } = await searchParams;

  const statusStr = typeof status === "string" ? status : undefined;
  const retailerIdStr =
    typeof retailerId === "string" ? retailerId : undefined;
  const searchStr = typeof search === "string" ? search : undefined;
  const sortStr = typeof sort === "string" ? sort : undefined;
  const dirStr = typeof dir === "string" ? dir : undefined;

  const sorted = resolveSort(
    { sort: sortStr, dir: dirStr },
    [
      "doNumber",
      "retailer",
      "orderDate",
      "deliveryDate",
      "status",
      "subtotal",
      "createdAt",
    ] as const,
    { field: "createdAt", dir: "desc" },
  );

  const [orders, retailers] = await Promise.all([
    getDeliveryOrders({
      status: statusStr,
      retailerId: retailerIdStr,
      search: searchStr,
      sort: sorted.field,
      dir: sorted.dir,
    }),
    getActiveRetailers(),
  ]);

  const hasFilters = statusStr || retailerIdStr || searchStr;
  // Passed to sortable headers so sort links preserve the active filters.
  const sp = {
    status: statusStr,
    retailerId: retailerIdStr,
    search: searchStr,
    sort: sortStr,
    dir: dirStr,
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Delivery Orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"}
            {hasFilters ? " matching filters" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/delivery-orders/new">
            <Plus className="size-4" />
            New DO
          </Link>
        </Button>
      </div>

      {/* Filters — apply on change, no submit button needed */}
      <form className="flex flex-wrap items-center gap-3" method="GET">
        {sortStr && <input type="hidden" name="sort" value={sortStr} />}
        {dirStr && <input type="hidden" name="dir" value={dirStr} />}
        <FilterSearch
          name="search"
          placeholder="Search by DO number or retailer..."
          defaultValue={searchStr ?? ""}
          className="w-full max-w-xs placeholder:text-muted-foreground"
        />
        <FilterSelect name="status" defaultValue={statusStr ?? ""}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </FilterSelect>
        <FilterSelect name="retailerId" defaultValue={retailerIdStr ?? ""}>
          <option value="">All Retailers</option>
          {retailers.map((r: { id: string; name: string }) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </FilterSelect>
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
            <Link href="/delivery-orders">
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
              <TableHead>DO Number</TableHead>
              <SortableHead field="retailer" label="Retailer" basePath="/delivery-orders" sp={sp} />
              <SortableHead field="orderDate" label="Order Date" basePath="/delivery-orders" sp={sp} />
              <SortableHead
                field="deliveryDate"
                label="Delivery Date"
                basePath="/delivery-orders"
                sp={sp}
              />
              <SortableHead field="status" label="Status" basePath="/delivery-orders" sp={sp} />
              <SortableHead
                field="subtotal"
                label="Subtotal"
                basePath="/delivery-orders"
                sp={sp}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="hover:bg-transparent">
                  <EmptyState
                    icon={PackageCheck}
                    title={
                      hasFilters
                        ? "No matching delivery orders"
                        : "No delivery orders yet"
                    }
                    description={
                      hasFilters
                        ? "Try clearing your filters."
                        : "Create your first DO to start shipping."
                    }
                    action={
                      !hasFilters && (
                        <Button asChild size="sm" variant="outline">
                          <Link href="/delivery-orders/new">
                            <Plus className="size-3.5" />
                            New DO
                          </Link>
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: DeliveryOrder) => {
                const badge = statusBadge[order.status] ?? statusBadge.DRAFT;
                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/delivery-orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.doNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {order.retailer.name}
                      {order.outlet && (
                        <span className="text-muted-foreground">
                          {" "}({order.outlet.name})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {format(new Date(order.orderDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {order.deliveryDate
                        ? format(new Date(order.deliveryDate), "dd MMM yyyy")
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatSGD(Number(order.subtotal))}
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
