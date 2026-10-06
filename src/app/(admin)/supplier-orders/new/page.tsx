import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveSuppliers } from "../../suppliers/actions";
import { getProductsForPicker } from "../actions";
import { SupplierOrderForm } from "@/components/supplier-orders/so-form";
import { getCurrentRole } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function NewSupplierOrderPage() {
  const [suppliers, products, role] = await Promise.all([
    getActiveSuppliers(),
    getProductsForPicker(),
    getCurrentRole(),
  ]);

  if (suppliers.length === 0) {
    redirect("/suppliers/new");
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/supplier-orders" className="hover:text-foreground">
          Supplier Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <h1 className="text-2xl font-semibold">New Supplier Order</h1>

      <SupplierOrderForm
        suppliers={suppliers}
        products={products}
        allowCosts={role === "admin"}
      />
    </div>
  );
}
