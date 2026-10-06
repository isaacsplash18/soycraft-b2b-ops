import Link from "next/link";
import { createProduct } from "../actions";
import { ProductForm } from "@/components/products/product-form";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <h1 className="text-2xl font-semibold">Add New Product</h1>

      <ProductForm action={createProduct} />
    </div>
  );
}
