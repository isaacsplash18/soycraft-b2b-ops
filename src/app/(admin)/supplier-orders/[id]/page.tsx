import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierOrder } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { SOStatusActions } from "@/components/supplier-orders/so-status-actions";
import { ConfirmDeliveryDialog } from "@/components/supplier-orders/confirm-delivery-dialog";
import { LineQtyAdjuster } from "@/components/supplier-orders/line-qty-adjuster";
import { SOPaymentPanel } from "@/components/supplier-orders/so-payment-panel";
import { getCurrentRole } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

const formatSGD = (v: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(v));

// Resolves the display label for a supplier-order line item, which can
// be either a catalog product or an ad-hoc "Other" item.
function lineSku(li: {
  product: { skuCode: string } | null;
}): string {
  return li.product?.skuCode ?? "—";
}
function lineName(li: {
  product: { name: string } | null;
  description: string | null;
}): string {
  return li.product?.name ?? li.description ?? "Other item";
}
function lineLabel(li: {
  product: { skuCode: string; name: string } | null;
  description: string | null;
}): string {
  if (li.product) return `${li.product.skuCode} — ${li.product.name}`;
  return li.description ?? "Other item";
}

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

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [so, role] = await Promise.all([getSupplierOrder(id), getCurrentRole()]);
  if (!so) notFound();

  const badge = statusBadge[so.status] ?? statusBadge.ORDERED;
  const canAdjust = so.status === "ORDERED" || so.status === "IN_TRANSIT";
  const canSeeCost = role === "admin";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/supplier-orders" className="hover:text-foreground">
          Supplier Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">{so.soNumber}</span>
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{so.soNumber}</h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {(so.status === "ORDERED" || so.status === "IN_TRANSIT") && (
            <ConfirmDeliveryDialog
              id={so.id}
              lineItems={so.lineItems.map((li) => ({
                id: li.id,
                productLabel: lineLabel(li),
                orderedQty: li.orderedQty,
              }))}
            />
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/supplier-orders/${so.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
          <SOStatusActions id={so.id} status={so.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Supplier</p>
          <Link
            href={`/suppliers/${so.supplier.id}`}
            className="font-medium text-primary hover:underline"
          >
            {so.supplier.name}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Order Date</p>
          <p className="font-medium">
            {format(new Date(so.orderDate), "dd MMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expected Delivery</p>
          <p className="font-medium">
            {so.expectedDeliveryDate
              ? format(new Date(so.expectedDeliveryDate), "dd MMM yyyy")
              : "\u2014"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual Delivery</p>
          <p className="font-medium">
            {so.actualDeliveryDate
              ? format(new Date(so.actualDeliveryDate), "dd MMM yyyy")
              : "\u2014"}
          </p>
        </div>
      </div>

      {canSeeCost && (
        <SOPaymentPanel
          id={so.id}
          subtotal={Number(so.subtotal)}
          amountPaid={Number(so.amountPaid)}
          paymentStatus={so.paymentStatus}
        />
      )}

      {so.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{so.notes}</p>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              {canSeeCost && (
                <TableHead className="text-right">Unit Cost</TableHead>
              )}
              {canSeeCost && (
                <TableHead className="text-right">Line Total</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {so.lineItems.map((li) => (
              <TableRow key={li.id}>
                <TableCell className="font-mono text-xs">
                  {lineSku(li)}
                </TableCell>
                <TableCell>
                  {lineName(li)}
                  {!li.product && (
                    <Badge
                      variant="secondary"
                      className="ml-2 align-middle text-[10px]"
                    >
                      Other
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canAdjust ? (
                    <LineQtyAdjuster
                      lineItemId={li.id}
                      productLabel={lineLabel(li)}
                      orderedQty={li.orderedQty}
                    />
                  ) : (
                    li.orderedQty
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {li.receivedQty ?? "\u2014"}
                </TableCell>
                {canSeeCost && (
                  <TableCell className="text-right">
                    {formatSGD(Number(li.unitCost))}
                  </TableCell>
                )}
                {canSeeCost && (
                  <TableCell className="text-right font-medium">
                    {formatSGD(Number(li.lineTotal))}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {canSeeCost && (
              <TableRow>
                <TableCell colSpan={5} className="text-right font-semibold">
                  Subtotal
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatSGD(Number(so.subtotal))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {so.adjustments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Adjustment History</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Before → After</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {so.adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(a.createdAt), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{a.productSku}</span>{" "}
                      <span className="text-muted-foreground">{a.productName}</span>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        a.delta < 0 ? "text-destructive" : "text-emerald-600"
                      }`}
                    >
                      {a.delta > 0 ? `+${a.delta}` : a.delta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.qtyBefore} → {a.qtyAfter}
                    </TableCell>
                    <TableCell className="text-sm">{a.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
