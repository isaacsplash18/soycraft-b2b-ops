"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "../actions";

interface ToggleActiveButtonProps {
  productId: string;
  isActive: boolean;
  toggleAction: (id: string) => Promise<ActionResult>;
}

export function ToggleActiveButton({
  productId,
  isActive,
  toggleAction,
}: ToggleActiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant={isActive ? "destructive" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await toggleAction(productId);
        });
      }}
    >
      {isPending && <Loader2 className="size-3 animate-spin" />}
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
