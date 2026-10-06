"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveSellThroughReport,
  rejectSellThroughReport,
  confirmSellThroughReport,
} from "../actions";
import { Loader2, Check, X, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface ReportActionsProps {
  reportId: string;
  status: string;
  retailerId: string;
  reportingMonth: string; // ISO string for the reporting month
}

export function ReportActions({
  reportId,
  status,
  retailerId,
  reportingMonth,
}: ReportActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = () => {
    if (
      !window.confirm(
        "Approve this report? This will create inventory ledger entries for sell-through."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await approveSellThroughReport(reportId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "Failed to approve report");
      }
    });
  };

  const handleConfirm = () => {
    if (
      !window.confirm(
        "Confirm this sell-through report? This will reduce inventory at the retailer/outlet."
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await confirmSellThroughReport(reportId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "Failed to confirm report");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectSellThroughReport(reportId, rejectNotes);
      if (result.success) {
        setShowRejectForm(false);
        router.refresh();
      } else {
        alert(result.error || "Failed to reject report");
      }
    });
  };

  if (status === "APPROVED") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
          <Check className="size-3.5" />
          Approved
        </span>
        <Button size="sm" className="bg-primary hover:bg-primary/90" asChild>
          <Link href="/invoices/generate">
            <FileText className="size-3.5" />
            Create Invoice
          </Link>
        </Button>
      </div>
    );
  }

  if (status === "INVOICED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
        Invoiced
      </span>
    );
  }

  if (status === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={isPending}
          onClick={handleConfirm}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          Confirm &amp; Reduce Inventory
        </Button>
        <span className="text-sm text-muted-foreground">
          Draft
        </span>
      </div>
    );
  }

  // SUBMITTED status — show approve/reject
  return (
    <div className="flex items-center gap-2">
      {showRejectForm ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rejection notes (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={handleReject}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
            Confirm Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRejectForm(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isPending}
            onClick={handleApprove}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => setShowRejectForm(true)}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </>
      )}
    </div>
  );
}
