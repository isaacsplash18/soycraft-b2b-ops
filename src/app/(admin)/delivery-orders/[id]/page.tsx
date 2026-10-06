import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeliveryOrder } from "../actions";
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
import { StatusActions } from "./status-actions";
import { PageTransition } from "@/components/ui/page-transition";

type DeliveryOrderDetail = NonNullable<
  Awaited<ReturnType<typeof getDeliveryOrder>>
>;

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

export default async function DeliveryOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getDeliveryOrder(id);

  if (!order) notFound();

  const badge = statusBadge[order.status] ?? statusBadge.DRAFT;

  return (
    <PageTransition className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/delivery-orders" className="hover:text-foreground">
          Delivery Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">{order.doNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{order.doNumber}</h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <StatusActions
          orderId={order.id}
          status={order.status}
        />
      </div>

      {/* Retailer */}
      <p className="text-muted-foreground">
        Retailer:{" "}
        <Link
          href={`/retailers/${order.retailer.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {order.retailer.name}
        </Link>
        {order.outlet && (
          <span className="ml-1 text-foreground">
            ({order.outlet.name})
          </span>
        )}
        {order.retailer.type === "CONSIGNMENT" && (
          <Badge className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Consignment
          </Badge>
        )}
      </p>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Order Date</p>
          <p className="font-medium">
            {format(new Date(order.orderDate), "dd MMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Delivery Date</p>
          <p className="font-medium">
            {order.deliveryDate
              ? format(new Date(order.deliveryDate), "dd MMM yyyy")
              : "\u2014"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Source Reference</p>
          <p className="font-medium">{order.sourceReference ?? "\u2014"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Created By</p>
          <p className="font-medium">{order.createdBy.name}</p>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Line Items Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lineItems.map(
                (
                  item: DeliveryOrderDetail["lineItems"][number],
                  idx: number
                ) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.product.skuCode}
                    </TableCell>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatSGD(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatSGD(Number(item.lineTotal))}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>

        {/* Subtotal */}
        <div className="flex justify-end">
          <div className="rounded-xl border bg-muted/30 px-6 py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Subtotal
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatSGD(Number(order.subtotal))}
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
