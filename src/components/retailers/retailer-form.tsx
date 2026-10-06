"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type {
  RetailerInput,
  ActionResult,
} from "@/app/(admin)/retailers/actions";
import { Loader2 } from "lucide-react";

type Retailer = RetailerInput & { id: string };

interface RetailerFormProps {
  retailer?: Retailer;
  action: (data: RetailerInput) => Promise<ActionResult>;
}

export function RetailerForm({ retailer, action }: RetailerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();

  const isEdit = !!retailer;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const data: RetailerInput = {
      name: fd.get("name") as string,
      code: (fd.get("code") as string) || "",
      contactPerson: (fd.get("contactPerson") as string) || undefined,
      email: fd.get("email") as string,
      phone: (fd.get("phone") as string) || undefined,
      address: (fd.get("address") as string) || undefined,
      type: fd.get("type") as "BUYOUT" | "CONSIGNMENT",
      paymentTerms: (fd.get("paymentTerms") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    };

    setFieldErrors({});
    setGlobalError(undefined);

    startTransition(async () => {
      const result = await action(data);
      if (result.success) {
        router.push(
          result.retailerId ? `/retailers/${result.retailerId}` : "/retailers"
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

      {/* Basic Info */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Basic Info</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={retailer?.name ?? ""}
              required
              aria-invalid={!!fieldErrors.name}
            />
            <FieldError errors={fieldErrors.name} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code">Retailer Code *</Label>
            <Input
              id="code"
              name="code"
              defaultValue={retailer?.code ?? ""}
              required
              maxLength={10}
              className="uppercase"
              placeholder="e.g. HUFT, PLC"
              aria-invalid={!!fieldErrors.code}
            />
            <p className="text-xs text-muted-foreground">
              Short code for DO numbering, e.g. HUFT, PLC
            </p>
            <FieldError errors={fieldErrors.code} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={retailer?.email ?? ""}
              required
              aria-invalid={!!fieldErrors.email}
            />
            <FieldError errors={fieldErrors.email} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={retailer?.phone ?? ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={retailer?.contactPerson ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            rows={2}
            defaultValue={retailer?.address ?? ""}
          />
        </div>
      </fieldset>

      {/* Business Details */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Business Details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="type">Retailer Type *</Label>
            <select
              id="type"
              name="type"
              defaultValue={retailer?.type ?? "BUYOUT"}
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="BUYOUT">Buy-out</option>
              <option value="CONSIGNMENT">Consignment</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paymentTerms">Payment Terms</Label>
            <Input
              id="paymentTerms"
              name="paymentTerms"
              placeholder="e.g. Net 30, COD"
              defaultValue={retailer?.paymentTerms ?? ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={retailer?.notes ?? ""}
          />
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary hover:bg-primary/90"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Update Retailer" : "Create Retailer"}
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
