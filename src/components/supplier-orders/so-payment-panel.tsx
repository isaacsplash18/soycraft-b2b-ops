"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { updateSupplierOrderPayment } from "@/app/(admin)/supplier-orders/actions";

const formatSGD = (v: number) =>
  new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(v);

const statusBadge: Record<string, { className: string; label: string }> = {
  UNPAID: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "Unpaid",
  },
  PARTIALLY_PAID: {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Partially Paid",
  },
  PAID: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    label: "Paid",
  },
};

interface Props {
  id: string;
  subtotal: number;
  amountPaid: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

export function SOPaymentPanel({ id, subtotal, amountPaid, paymentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(amountPaid.toFixed(2));
  const [error, setError] = useState<string | null>(null);

  const badge = statusBadge[paymentStatus];
  const outstanding = Math.max(0, subtotal - amountPaid);

  const save = (newAmount: number) => {
    setError(null);
    startTransition(async () => {
      const result = await updateSupplierOrderPayment(id, newAmount);
      if (result.success) {
        toast.success(
          newAmount >= subtotal
            ? "Marked as fully paid"
            : newAmount === 0
              ? "Payment reset to unpaid"
              : "Payment updated"
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
        <Badge className={badge.className}>{badge.label}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="text-lg font-medium tabular-nums">{formatSGD(subtotal)}</p>
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
          <Label htmlFor="amountPaid" className="text-xs">
            Amount Paid (SGD)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="amountPaid"
              type="number"
              step="0.01"
              min="0"
              max={subtotal}
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
            Edit Amount
          </Button>
          {paymentStatus !== "PAID" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => save(subtotal)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Mark Fully Paid"
              )}
            </Button>
          )}
          {paymentStatus !== "UNPAID" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => save(0)}
              disabled={isPending}
            >
              Reset to Unpaid
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
