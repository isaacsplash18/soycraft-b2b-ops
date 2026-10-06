"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { updateInvoicePayment } from "@/app/(admin)/invoices/actions";

const formatSGD = (v: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(v);

interface Props {
  id: string;
  total: number;
  amountPaid: number;
  status: string;
}

export function InvoicePaymentPanel({ id, total, amountPaid, status }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(amountPaid.toFixed(2));
  const [error, setError] = useState<string | null>(null);

  const outstanding = Math.max(0, total - amountPaid);
  const partiallyPaid = amountPaid > 0 && status !== "PAID";

  const save = (newAmount: number) => {
    setError(null);
    startTransition(async () => {
      const result = await updateInvoicePayment(id, newAmount);
      if (result.success) {
        toast.success(
          newAmount >= total ? "Invoice marked as paid" : "Payment recorded",
        );
        setEditing(false);
        router.refresh();
      } else {
        const message =
          result.fieldErrors?.amountPaid?.[0] ?? result.error ?? "Failed to update";
        setError(message);
        toast.error(message);
      }
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Payment</h2>
        {partiallyPaid && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Partially Paid
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="text-lg font-medium tabular-nums">{formatSGD(total)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Paid
          </p>
          <p className="text-lg font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatSGD(amountPaid)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Outstanding
          </p>
          <p className="text-lg font-medium tabular-nums text-destructive">
            {formatSGD(outstanding)}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Label htmlFor="invAmountPaid" className="text-xs">
            Amount Paid (SGD)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="invAmountPaid"
              type="number"
              step="0.01"
              min="0"
              max={total}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-[160px]"
            />
            <Button
              size="sm"
              onClick={() => save(parseFloat(amount) || 0)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setAmount(amountPaid.toFixed(2));
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Record Payment
          </Button>
          {status !== "PAID" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => save(total)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Mark Fully Paid"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
