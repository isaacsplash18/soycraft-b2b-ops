"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  updateSupplierOrderStatus,
  deleteSupplierOrder,
} from "@/app/(admin)/supplier-orders/actions";
import { Loader2 } from "lucide-react";

export function SOStatusActions({
  id,
  status,
}: {
  id: string;
  status: "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function set(next: "ORDERED" | "IN_TRANSIT" | "CANCELLED") {
    setError(undefined);
    startTransition(async () => {
      const r = await updateSupplierOrderStatus(id, next);
      if (!r.success) {
        setError(r.error);
        toast.error(r.error ?? "Failed to update supplier order");
      } else {
        toast.success(
          next === "IN_TRANSIT"
            ? "Supplier order marked in transit"
            : next === "CANCELLED"
              ? "Supplier order cancelled"
              : "Supplier order set to ordered"
        );
        router.refresh();
      }
    });
  }

  function del() {
    if (!confirm("Delete this supplier order? This cannot be undone.")) return;
    setError(undefined);
    startTransition(async () => {
      const r = await deleteSupplierOrder(id);
      if (!r.success) {
        setError(r.error);
        toast.error(r.error ?? "Failed to delete supplier order");
      } else {
        toast.success("Supplier order deleted");
        router.push("/supplier-orders");
      }
    });
  }

  if (status === "DELIVERED") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={del} disabled={pending}>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Delete
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => set("ORDERED")}
          disabled={pending}
        >
          Reopen
        </Button>
        <Button variant="outline" size="sm" onClick={del} disabled={pending}>
          Delete
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "ORDERED" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => set("IN_TRANSIT")}
          disabled={pending}
        >
          Mark In Transit
        </Button>
      )}
      {status === "IN_TRANSIT" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => set("ORDERED")}
          disabled={pending}
        >
          Back to Ordered
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => set("CANCELLED")}
        disabled={pending}
      >
        Cancel
      </Button>
      <Button variant="outline" size="sm" onClick={del} disabled={pending}>
        Delete
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
