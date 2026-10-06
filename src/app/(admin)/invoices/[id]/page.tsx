import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "../actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { InvoiceStatusActions } from "./status-actions";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { InvoicePaymentPanel } from "@/components/invoices/invoice-payment-panel";
import { Pencil } from "lucide-react";

type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

const statusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: {
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    label: "Draft",
  },
  SENT: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Sent",
  },
  PAID: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Paid",
  },
  OVERDUE: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Overdue",
  },
  VOID: {
    className:
      "bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500",
    label: "Void",
  },
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) notFound();

  const badge = statusBadge[invoice.status] ?? statusBadge.DRAFT;

  // Separate product and ad-hoc line items
  const productItems = invoice.lineItems.filter(
    (item) => item.productId !== null
  );
  const adHocItems = invoice.lineItems.filter(
    (item) => item.productId === null
  );

  return (
    <PageTransition className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/invoices" className="hover:text-foreground">
          Invoices
        </Link>
        <span>/</span>
        <span className="text-foreground">{invoice.invoiceNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "DRAFT" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          )}
          <InvoiceStatusActions invoiceId={invoice.id} status={invoice.status} />
        </div>
      </div>

      {/* Retailer */}
      <p className="text-muted-foreground">
        Retailer:{" "}
        <Link
          href={`/retailers/${invoice.retailer.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {invoice.retailer.name}
        </Link>
        {invoice.outlet && (
          <span className="text-muted-foreground">
            {" "}
            &mdash; {invoice.outlet.name}
          </span>
        )}
      </p>

      {/* Info Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Invoice Date</p>
          <p className="font-medium">
            {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Due Date</p>
          <p className="font-medium">
            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Billing Month</p>
          <p className="font-medium">
            {format(new Date(invoice.billingMonth), "MMM yyyy")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payment Terms</p>
          <p className="font-medium">
            {invoice.retailer.paymentTerms ?? "Net 30"}
          </p>
        </div>
      </div>

      {/* Payment tracking */}
      {(invoice.status === "SENT" ||
        invoice.status === "OVERDUE" ||
        invoice.status === "PAID") && (
        <InvoicePaymentPanel
          id={invoice.id}
          total={Number(invoice.total)}
          amountPaid={Number(invoice.amountPaid)}
          status={invoice.status}
        />
      )}

      {/* Paid date */}
      {invoice.status === "PAID" && invoice.paidAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Paid on {format(new Date(invoice.paidAt), "dd MMM yyyy, h:mm a")}
        </div>
      )}

      {/* Product Line Items Table */}
      {productItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Product Line Items</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productItems.map(
                  (item: InvoiceDetail["lineItems"][number], idx: number) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.product?.skuCode ?? "-"}
                      </TableCell>
                      <TableCell>{item.product?.name ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSGD(Number(item.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatSGD(Number(item.lineTotal))}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Ad-hoc Line Items */}
      {adHocItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Additional Items</h2>
          <div className="rounded-lg border border-dashed">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adHocItems.map(
                  (item: InvoiceDetail["lineItems"][number], idx: number) => {
                    const lt = Number(item.lineTotal);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.description ?? "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatSGD(Number(item.unitPrice))}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            lt < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {formatSGD(lt)}
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="flex justify-end">
        <div className="min-w-[320px] rounded-xl border bg-gradient-to-br from-orange-50/60 to-transparent px-6 py-5 shadow-sm dark:from-orange-950/20">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatSGD(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                GST ({(Number(invoice.gstRate) * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums">{formatSGD(Number(invoice.gstAmount))}</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t pt-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Due
            </span>
            <span className="text-3xl font-semibold tabular-nums text-primary">
              {formatSGD(Number(invoice.total))}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}
    </PageTransition>
  );
}
