import Link from "next/link";
import { createSupplier } from "../actions";
import { SupplierForm } from "@/components/suppliers/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/suppliers" className="hover:text-foreground">
          Suppliers
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <h1 className="text-2xl font-semibold">Add New Supplier</h1>

      <SupplierForm action={createSupplier} />
    </div>
  );
}
