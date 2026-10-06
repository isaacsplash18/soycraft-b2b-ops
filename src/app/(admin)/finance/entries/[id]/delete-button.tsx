"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { deleteFinanceEntry } from "@/app/(admin)/finance/actions";

export function DeleteEntryButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this finance entry?")) return;
        startTransition(async () => {
          const r = await deleteFinanceEntry(id);
          if (r.success) router.push("/finance/entries");
        });
      }}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      Delete
    </Button>
  );
}
