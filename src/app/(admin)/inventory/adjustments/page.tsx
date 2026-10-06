import Link from "next/link";
import { getActiveProducts, getActiveRetailers } from "../actions";
import { AdjustmentForm } from "@/components/inventory/adjustment-form";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const [products, retailers] = await Promise.all([
    getActiveProducts(),
    getActiveRetailers(),
  ]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/inventory"
          className="text-primary hover:underline"
        >
          Inventory
        </Link>
        <span>/</span>
        <span>Manual Adjustment</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-semibold">Manual Adjustment</h1>

      {/* Form */}
      <AdjustmentForm products={products} retailers={retailers} />
    </div>
  );
}
