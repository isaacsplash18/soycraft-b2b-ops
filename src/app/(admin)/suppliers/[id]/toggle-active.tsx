"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toggleSupplierActive } from "../actions";
import { Loader2 } from "lucide-react";

export function ToggleSupplierActive({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleSupplierActive(id);
          router.refresh();
        })
      }
    >
      {isPending && <Loader2 className="size-3.5 animate-spin" />}
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
}
