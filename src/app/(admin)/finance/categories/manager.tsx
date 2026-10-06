"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  createOtherSubCategory,
  deleteOtherSubCategory,
} from "@/app/(admin)/finance/actions";

type Category = { id: string; name: string };

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function add() {
    if (!name.trim()) return;
    setError(undefined);
    startTransition(async () => {
      const r = await createOtherSubCategory(name);
      if (r.success) {
        setName("");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this category?")) return;
    startTransition(async () => {
      await deleteOtherSubCategory(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          onClick={add}
          disabled={pending}
          className="bg-primary hover:bg-primary/90"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="rounded-lg border divide-y">
        {categories.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm">{c.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(c.id)}
                disabled={pending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
