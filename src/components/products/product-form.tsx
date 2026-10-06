"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ProductInput, ActionResult } from "@/app/(admin)/products/actions";
import { Loader2 } from "lucide-react";

type Product = ProductInput & { id: string };

interface ProductFormProps {
  product?: Product;
  action: (data: ProductInput) => Promise<ActionResult>;
}

export function ProductForm({ product, action }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();

  const isEdit = !!product;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const data: ProductInput = {
      skuCode: fd.get("skuCode") as string,
      name: fd.get("name") as string,
      category: (fd.get("category") as string) || undefined,
      msrp: Number(fd.get("msrp")),
      weightKg: fd.get("weightKg") ? Number(fd.get("weightKg")) : undefined,
      barcode: (fd.get("barcode") as string) || undefined,
      shopifyVariantId: (fd.get("shopifyVariantId") as string) || undefined,
      imageUrl: (fd.get("imageUrl") as string) || undefined,
    };

    setFieldErrors({});
    setGlobalError(undefined);

    startTransition(async () => {
      const result = await action(data);
      if (result.success) {
        router.push(result.productId ? `/products/${result.productId}` : "/products");
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
            <Label htmlFor="skuCode">SKU Code *</Label>
            <Input
              id="skuCode"
              name="skuCode"
              defaultValue={product?.skuCode ?? ""}
              required
              aria-invalid={!!fieldErrors.skuCode}
            />
            <FieldError errors={fieldErrors.skuCode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              required
              aria-invalid={!!fieldErrors.name}
            />
            <FieldError errors={fieldErrors.name} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={product?.category ?? ""}
            placeholder="e.g. Tofu, Soy Milk, Tempeh"
          />
        </div>
      </fieldset>

      {/* Pricing */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Pricing</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="msrp">MSRP (SGD) *</Label>
            <Input
              id="msrp"
              name="msrp"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.msrp ?? ""}
              required
              aria-invalid={!!fieldErrors.msrp}
            />
            <FieldError errors={fieldErrors.msrp} />
          </div>

        </div>
      </fieldset>

      {/* Physical */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Physical</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="weightKg">Weight (kg)</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.weightKg ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              name="barcode"
              defaultValue={product?.barcode ?? ""}
            />
          </div>
        </div>
      </fieldset>

      {/* Integration */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Integration</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="shopifyVariantId">Shopify Variant ID</Label>
            <Input
              id="shopifyVariantId"
              name="shopifyVariantId"
              defaultValue={product?.shopifyVariantId ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://..."
              defaultValue={product?.imageUrl ?? ""}
              aria-invalid={!!fieldErrors.imageUrl}
            />
            <FieldError errors={fieldErrors.imageUrl} />
          </div>
        </div>
      </fieldset>

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Update Product" : "Create Product"}
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
  return (
    <p className="text-xs text-destructive">{errors.join(", ")}</p>
  );
}
