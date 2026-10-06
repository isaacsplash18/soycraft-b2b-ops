"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { confirmSupplierOrderDelivery } from "@/app/(admin)/supplier-orders/actions";
import { CheckCircle2, Loader2 } from "lucide-react";

type Line = { id: string; productLabel: string; orderedQty: number };

export function ConfirmDeliveryDialog({
  id,
  lineItems,
}: {
  id: string;
  lineItems: Line[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState<Record<string, number>>(
    Object.fromEntries(lineItems.map((l) => [l.id, l.orderedQty]))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const r = await confirmSupplierOrderDelivery({
        id,
        actualDeliveryDate: new Date(date),
        receivedQuantities: lineItems.map((l) => ({
          lineItemId: l.id,
          receivedQty: received[l.id] ?? l.orderedQty,
        })),
      });
      if (!r.success) {
        setError(r.error ?? "Failed to confirm delivery");
        toast.error(r.error ?? "Failed to confirm delivery");
      } else {
        toast.success("Delivery confirmed");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" />
        }
      >
        <CheckCircle2 className="size-3.5" />
        Confirm Delivery
      </DialogTrigger>
      <DialogContent className="grid max-h-[85vh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>Confirm Delivery</DialogTitle>
        </DialogHeader>

        {/* Scrollable body — keeps the footer in view when many line items push past the viewport */}
        <div className="-mr-2 space-y-4 overflow-y-auto pr-2">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="actualDate">Actual Delivery Date *</Label>
            <Input
              id="actualDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Received Quantities</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {lineItems.map((l) => (
                <div key={l.id} className="grid grid-cols-3 items-center gap-3">
                  <span className="col-span-2 text-sm">{l.productLabel}</span>
                  <Input
                    type="number"
                    min={0}
                    value={received[l.id] ?? 0}
                    onChange={(e) =>
                      setReceived((p) => ({ ...p, [l.id]: Number(e.target.value) }))
                    }
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              A finance entry will be auto-created under Inventory.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
