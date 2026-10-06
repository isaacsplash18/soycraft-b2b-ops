import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInvoice, getActiveRetailers } from "../../actions";
import { InvoiceForm } from "../../generate/invoice-form";
import type { InvoiceEditInitial } from "../../generate/invoice-form";

export const dynamic = "force-dynamic";

function toDateInput(d: Date): string {
  return new Date(d).toISOString().split("T")[0];
}

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, retailers] = await Promise.all([
    getInvoice(id),
    getActiveRetailers(),
  ]);

  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Only draft invoices can be edited. This invoice is{" "}
          <span className="font-medium">{invoice.status}</span>.
        </p>
        <Button asChild variant="outline">
          <Link href={`/invoices/${id}`}>Back to invoice</Link>
        </Button>
      </div>
    );
  }

  const initial: InvoiceEditInitial = {
    id: invoice.id,
    retailerId: invoice.retailerId,
    outletId: invoice.outletId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: toDateInput(invoice.invoiceDate),
    dueDate: toDateInput(invoice.dueDate),
    sourceReference: invoice.sourceReference,
    notes: invoice.notes,
    productLineItems: invoice.lineItems
      .filter((li) => li.productId !== null)
      .map((li) => ({
        productId: li.productId as string,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
      })),
    adHocLineItems: invoice.lineItems
      .filter((li) => li.productId === null)
      .map((li) => ({
        description: li.description ?? "",
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
      })),
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:text-foreground">
          Invoices
        </Link>
        <span>/</span>
        <Link href={`/invoices/${id}`} className="hover:text-foreground">
          {invoice.invoiceNumber}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/invoices/${id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Edit {invoice.invoiceNumber}</h1>
      </div>

      <InvoiceForm retailers={retailers} initial={initial} />
    </div>
  );
}
