import Link from "next/link";
import { createRetailer } from "../actions";
import { RetailerForm } from "@/components/retailers/retailer-form";

export default function NewRetailerPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/retailers" className="hover:text-foreground">
          Retailers
        </Link>
        <span>/</span>
        <span className="text-foreground">New</span>
      </nav>

      <h1 className="text-2xl font-semibold">Add New Retailer</h1>

      <RetailerForm action={createRetailer} />
    </div>
  );
}
