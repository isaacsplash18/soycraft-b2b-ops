import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier } from "../actions";
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
import { ToggleSupplierActive } from "./toggle-active";

export const dynamic = "force-dynamic";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

const soStatusBadge: Record<string, { className: string; label: string }> = {
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

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  type SO = (typeof supplier.supplierOrders)[number];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/suppliers" className="hover:text-foreground">
          Suppliers
        </Link>
        <span>/</span>
        <span className="text-foreground">{supplier.name}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{supplier.name}</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {supplier.code}
          </span>
          {supplier.isActive ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Active
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Inactive
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ToggleSupplierActive id={supplier.id} isActive={supplier.isActive} />
          <Button variant="outline" size="sm" asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Contact</p>
          <p className="font-medium">{supplier.contactPerson ?? "\u2014"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="font-medium">{supplier.email ?? "\u2014"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Phone</p>
          <p className="font-medium">{supplier.phone ?? "\u2014"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Address</p>
          <p className="font-medium">{supplier.address ?? "\u2014"}</p>
        </div>
      </div>

      {supplier.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Supplier Orders</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplier.supplierOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No supplier orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                supplier.supplierOrders.map((so: SO) => {
                  const badge = soStatusBadge[so.status] ?? soStatusBadge.ORDERED;
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
                      <TableCell>
                        {format(new Date(so.orderDate), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {so.expectedDeliveryDate
                          ? format(new Date(so.expectedDeliveryDate), "dd MMM yyyy")
                          : "\u2014"}
                      </TableCell>
                      <TableCell>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatSGD(Number(so.subtotal))}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
