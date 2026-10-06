"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateInvoiceStatus, sendInvoice } from "../actions";
import {
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Download,
  AlertTriangle,
} from "lucide-react";

interface StatusActionsProps {
  invoiceId: string;
  status: string;
}

export function InvoiceStatusActions({ invoiceId, status }: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAction = (action: "SENT" | "PAID" | "VOID") => {
    const messages: Record<string, string> = {
      SENT: "Mark this invoice as sent?",
      PAID: "Mark this invoice as paid?",
      VOID: "Are you sure you want to void this invoice? This cannot be undone.",
    };

    const successMessages: Record<string, string> = {
      SENT: "Invoice marked as sent",
      PAID: "Invoice marked as paid",
      VOID: "Invoice voided",
    };

    if (!window.confirm(messages[action])) return;

    startTransition(async () => {
      const result =
        action === "SENT"
          ? await sendInvoice(invoiceId)
          : await updateInvoiceStatus(invoiceId, action);

      if (result.success) {
        toast.success(successMessages[action]);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update invoice status");
      }
    });
  };

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;

  return (
    <div className="flex items-center gap-2">
      {/* PDF download — available for all statuses except VOID */}
      {status !== "VOID" && (
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl}>
            <Download className="size-3.5" />
            Download PDF
          </a>
        </Button>
      )}

      {/* DRAFT actions */}
      {status === "DRAFT" && (
        <>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            disabled={isPending}
            onClick={() => handleAction("SENT")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Send
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction("VOID")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Void
          </Button>
        </>
      )}

      {/* SENT actions */}
      {status === "SENT" && (
        <>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isPending}
            onClick={() => handleAction("PAID")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle className="size-3.5" />
            )}
            Mark as Paid
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction("VOID")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Void
          </Button>
        </>
      )}

      {/* OVERDUE actions — same as SENT but with warning */}
      {status === "OVERDUE" && (
        <>
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle className="size-3 mr-1" />
            Overdue
          </Badge>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={isPending}
            onClick={() => handleAction("PAID")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle className="size-3.5" />
            )}
            Mark as Paid
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleAction("VOID")}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Void
          </Button>
        </>
      )}
    </div>
  );
}
