import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplierOrder, getProductsForPicker } from "../../actions";
import { getActiveSuppliers } from "../../../suppliers/actions";
import { SupplierOrderForm } from "@/components/supplier-orders/so-form";
import { getCurrentRole } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function EditSupplierOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [so, suppliers, products, role] = await Promise.all([
    getSupplierOrder(id),
    getActiveSuppliers(),
    getProductsForPicker(),
    getCurrentRole(),
  ]);
  if (!so) notFound();

  const status: "ORDERED" | "IN_TRANSIT" =
    so.status === "IN_TRANSIT" ? "IN_TRANSIT" : "ORDERED";

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/supplier-orders" className="hover:text-foreground">
          Supplier Orders
        </Link>
        <span>/</span>
        <Link
          href={`/supplier-orders/${so.id}`}
          className="hover:text-foreground"
        >
          {so.soNumber}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      <h1 className="text-2xl font-semibold">Edit Supplier Order</h1>

      <SupplierOrderForm
        suppliers={suppliers}
        products={products}
        allowCosts={role === "admin"}
        initial={{
          id: so.id,
          supplierId: so.supplierId,
          soNumber: so.soNumber,
          orderDate: new Date(so.orderDate).toISOString().slice(0, 10),
          expectedDeliveryDate: so.expectedDeliveryDate
            ? new Date(so.expectedDeliveryDate).toISOString().slice(0, 10)
            : null,
          notes: so.notes,
          status,
          lineItems: so.lineItems.map((li) => ({
            productId: li.productId,
            description: li.description,
            orderedQty: li.orderedQty,
            unitCost: Number(li.unitCost),
          })),
        }}
      />
    </div>
  );
}
