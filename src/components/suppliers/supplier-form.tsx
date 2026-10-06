"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type {
  SupplierInput,
  ActionResult,
} from "@/app/(admin)/suppliers/actions";
import { Loader2 } from "lucide-react";

type Supplier = SupplierInput & { id: string };

interface SupplierFormProps {
  supplier?: Supplier;
  action: (data: SupplierInput) => Promise<ActionResult>;
}

export function SupplierForm({ supplier, action }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();

  const isEdit = !!supplier;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const data: SupplierInput = {
      name: fd.get("name") as string,
      code: ((fd.get("code") as string) || "").toUpperCase(),
      contactPerson: (fd.get("contactPerson") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      phone: (fd.get("phone") as string) || undefined,
      address: (fd.get("address") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    };

    setFieldErrors({});
    setGlobalError(undefined);

    startTransition(async () => {
      const result = await action(data);
      if (result.success) {
        router.push(
          result.supplierId ? `/suppliers/${result.supplierId}` : "/suppliers"
        );
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.error) setGlobalError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">
      {globalError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {globalError}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Basic Info</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={supplier?.name ?? ""}
              required
              aria-invalid={!!fieldErrors.name}
            />
            <FieldError errors={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code">Supplier Code *</Label>
            <Input
              id="code"
              name="code"
              defaultValue={supplier?.code ?? ""}
              required
              maxLength={10}
              className="uppercase"
              placeholder="e.g. ACME, FARM"
              aria-invalid={!!fieldErrors.code}
            />
            <p className="text-xs text-muted-foreground">
              Short code used for SO numbering, e.g. ACME, FARM
            </p>
            <FieldError errors={fieldErrors.code} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={supplier?.email ?? ""}
              aria-invalid={!!fieldErrors.email}
            />
            <FieldError errors={fieldErrors.email} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={supplier?.phone ?? ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={supplier?.contactPerson ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            rows={2}
            defaultValue={supplier?.address ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={supplier?.notes ?? ""}
          />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary hover:bg-primary/90"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Update Supplier" : "Create Supplier"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors.join(", ")}</p>;
}
