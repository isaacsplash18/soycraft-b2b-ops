"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Loader2 } from "lucide-react";
import { adjustSupplierOrderLineQty } from "@/app/(admin)/supplier-orders/actions";

export function LineQtyAdjuster({
  lineItemId,
  productLabel,
  orderedQty,
}: {
  lineItemId: string;
  productLabel: string;
  orderedQty: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("-1");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [reasonError, setReasonError] = useState<string>();

  const deltaNum = Number(delta);
  const newQty = Number.isFinite(deltaNum) ? orderedQty + deltaNum : orderedQty;

  function reset() {
    setDelta("-1");
    setReason("");
    setError(undefined);
    setReasonError(undefined);
  }

  function submit() {
    setError(undefined);
    setReasonError(undefined);
    startTransition(async () => {
      const r = await adjustSupplierOrderLineQty(lineItemId, deltaNum, reason);
      if (r.success) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        if (r.fieldErrors?.reason) setReasonError(r.fieldErrors.reason[0]);
        if (r.error) setError(r.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            aria-label="Adjust quantity"
          />
        }
      >
        <span className="font-medium tabular-nums">{orderedQty}</span>
        <Pencil className="size-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Line Quantity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{productLabel}</span>
            <br />
            Current ordered qty: <span className="font-medium">{orderedQty}</span>
          </p>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="delta">Change by *</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDelta(String(deltaNum - 1))}
              >
                −1
              </Button>
              <Input
                id="delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className="text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDelta(String(deltaNum + 1))}
              >
                +1
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use negative to reduce, positive to add. New qty:{" "}
              <span className="font-medium">{Math.max(0, newQty)}</span>
              {newQty <= 0 && deltaNum !== 0 && " (line will be removed)"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer ordered 3 units from in-transit stock"
              aria-invalid={!!reasonError}
            />
            {reasonError && (
              <p className="text-xs text-destructive">{reasonError}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || deltaNum === 0 || !reason.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
