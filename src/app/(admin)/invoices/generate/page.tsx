import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveRetailers } from "../actions";
import { InvoiceForm } from "./invoice-form";

export const dynamic = "force-dynamic";

export default async function CreateInvoicePage() {
  const retailers = await getActiveRetailers();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:text-foreground">
          Invoices
        </Link>
        <span>/</span>
        <span className="text-foreground">Create Invoice</span>
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Create Invoice</h1>
      </div>

      <InvoiceForm retailers={retailers} />
    </div>
  );
}
