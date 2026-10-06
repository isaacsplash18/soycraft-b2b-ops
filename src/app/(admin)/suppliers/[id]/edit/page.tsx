import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier, updateSupplier } from "../../actions";
import { SupplierForm } from "@/components/suppliers/supplier-form";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/suppliers" className="hover:text-foreground">
          Suppliers
        </Link>
        <span>/</span>
        <Link
          href={`/suppliers/${id}`}
          className="hover:text-foreground"
        >
          {supplier.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      <h1 className="text-2xl font-semibold">Edit Supplier</h1>

      <SupplierForm
        supplier={{
          id: supplier.id,
          name: supplier.name,
          code: supplier.code,
          contactPerson: supplier.contactPerson ?? undefined,
          email: supplier.email ?? undefined,
          phone: supplier.phone ?? undefined,
          address: supplier.address ?? undefined,
          notes: supplier.notes ?? undefined,
        }}
        action={(data) => updateSupplier(id, data)}
      />
    </div>
  );
}
