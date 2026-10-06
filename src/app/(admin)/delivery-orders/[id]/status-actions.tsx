"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateDeliveryOrderStatus } from "../actions";
import { Loader2, Check, X, Truck, Download, Pencil } from "lucide-react";

interface StatusActionsProps {
  orderId: string;
  status: string;
}

export function StatusActions({ orderId, status }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: string) => {
    if (
      newStatus === "CANCELLED" &&
      !window.confirm("Are you sure you want to cancel this delivery order?")
    ) {
      return;
    }
    if (
      newStatus === "DELIVERED" &&
      !window.confirm(
        "Mark as delivered? This will create inventory ledger entries."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await updateDeliveryOrderStatus(orderId, newStatus);
      if (result.success) {
        toast.success(
          newStatus === "CONFIRMED"
            ? "Delivery order confirmed"
            : newStatus === "DELIVERED"
              ? "Delivery order marked as delivered"
              : newStatus === "CANCELLED"
                ? "Delivery order cancelled"
                : "Delivery order updated"
        );
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update status");
      }
    });
  };

  const pdfUrl = `/api/delivery-orders/${orderId}/pdf`;
  const canEdit = status === "DRAFT" || status === "CONFIRMED";

  return (
    <div className="flex items-center gap-2">
      {/* PDF download for CONFIRMED and DELIVERED */}
      {(status === "CONFIRMED" || status === "DELIVERED") && (
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl}>
            <Download className="size-3.5" />
            Download PDF
          </a>
        </Button>
      )}

      {/* Edit button for DRAFT and CONFIRMED */}
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <Link href={`/delivery-orders/${orderId}/edit`}>
            <Pencil className="size-3.5" />
            Edit
          </Link>
        </Button>
      )}

      {/* DRAFT actions */}
      {status === "DRAFT" && (
        <>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            disabled={isPending}
            onClick={() => handleStatusChange("CONFIRMED")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleStatusChange("CANCELLED")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Cancel
          </Button>
        </>
      )}

      {/* CONFIRMED actions */}
      {status === "CONFIRMED" && (
        <>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isPending}
            onClick={() => handleStatusChange("DELIVERED")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Truck className="size-3.5" />
            )}
            Mark as Delivered
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleStatusChange("CANCELLED")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Cancel
          </Button>
        </>
      )}
    </div>
  );
}
