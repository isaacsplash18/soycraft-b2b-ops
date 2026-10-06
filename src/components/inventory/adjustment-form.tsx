"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  createAdjustment,
  getCurrentStock,
  type AdjustmentInput,
} from "@/app/(admin)/inventory/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutletOption = { id: string; name: string; code: string };

interface AdjustmentFormProps {
  products: { id: string; name: string; skuCode: string }[];
  retailers: { id: string; name: string; outlets?: OutletOption[] }[];
}

const MOVEMENT_TYPES = [
  { value: "RESTOCK", label: "Restock" },
  { value: "DAMAGE_WRITEOFF", label: "Damage / Write-off" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "RETURN_TO_SOYCRAFT", label: "Return to Soycraft" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdjustmentForm({ products, retailers }: AdjustmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form fields
  const [productId, setProductId] = useState("");
  const [location, setLocation] = useState<"WAREHOUSE" | string>("WAREHOUSE");
  const [outletId, setOutletId] = useState("");
  const [movementType, setMovementType] = useState<string>("");
  const [quantityChange, setQuantityChange] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Current stock display
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Get outlets for selected retailer
  const selectedRetailer = retailers.find((r) => r.id === location);
  const outlets = selectedRetailer?.outlets ?? [];

  // Reset outlet when retailer changes
  useEffect(() => {
    setOutletId("");
  }, [location]);

  // Fetch current stock when product or location changes
  useEffect(() => {
    if (!productId) {
      setCurrentStock(null);
      return;
    }

    const retailerId = location === "WAREHOUSE" ? null : location;

    setLoadingStock(true);
    getCurrentStock(productId, retailerId, outletId || null)
      .then((stock) => setCurrentStock(stock))
      .catch(() => setCurrentStock(null))
      .finally(() => setLoadingStock(false));
  }, [productId, location, outletId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const data: AdjustmentInput = {
      productId,
      retailerId: location === "WAREHOUSE" ? null : location,
      outletId: outletId || null,
      quantityChange: parseInt(quantityChange, 10),
      movementType: movementType as AdjustmentInput["movementType"],
      notes,
    };

    startTransition(async () => {
      const result = await createAdjustment(data);

      if (result.success) {
        toast.success("Adjustment recorded successfully");
        router.push("/inventory");
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else if (result.error) {
        setFormError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {formError}
        </div>
      )}

      {/* Product */}
      <div className="space-y-1.5">
        <Label htmlFor="productId">
          Product <span className="text-red-500">*</span>
        </Label>
        <select
          id="productId"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          required
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select a product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.skuCode} - {p.name}
            </option>
          ))}
        </select>
        {fieldErrors.productId && (
          <p className="text-xs text-red-500">{fieldErrors.productId[0]}</p>
        )}
      </div>

      {/* Location (Retailer) */}
      <div className="space-y-1.5">
        <Label htmlFor="location">
          Location <span className="text-red-500">*</span>
        </Label>
        <select
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="WAREHOUSE">Warehouse</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {fieldErrors.retailerId && (
          <p className="text-xs text-red-500">{fieldErrors.retailerId[0]}</p>
        )}
      </div>

      {/* Outlet (if retailer has outlets) */}
      {location !== "WAREHOUSE" && outlets.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="outletId">Outlet</Label>
          <select
            id="outletId"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All outlets (general)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current stock */}
      {productId && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current stock at location:</span>
              {loadingStock ? (
                <Loader2 className="size-3 animate-spin text-muted-foreground" />
              ) : (
                <span className="font-semibold">
                  {currentStock ?? 0}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement Type */}
      <div className="space-y-1.5">
        <Label htmlFor="movementType">
          Movement Type <span className="text-red-500">*</span>
        </Label>
        <select
          id="movementType"
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          required
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select movement type...</option>
          {MOVEMENT_TYPES.map((mt) => (
            <option key={mt.value} value={mt.value}>
              {mt.label}
            </option>
          ))}
        </select>
        {fieldErrors.movementType && (
          <p className="text-xs text-red-500">{fieldErrors.movementType[0]}</p>
        )}
      </div>

      {/* Quantity Change */}
      <div className="space-y-1.5">
        <Label htmlFor="quantityChange">
          Quantity Change <span className="text-red-500">*</span>
        </Label>
        <Input
          id="quantityChange"
          type="number"
          value={quantityChange}
          onChange={(e) => setQuantityChange(e.target.value)}
          placeholder="e.g. 50 for stock in, -10 for stock out"
          required
        />
        <p className="text-xs text-muted-foreground">
          Positive for stock in, negative for stock out
        </p>
        {fieldErrors.quantityChange && (
          <p className="text-xs text-red-500">
            {fieldErrors.quantityChange[0]}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for adjustment (min 10 characters)..."
          required
          minLength={10}
          rows={3}
        />
        {fieldErrors.notes && (
          <p className="text-xs text-red-500">{fieldErrors.notes[0]}</p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Recording...
          </>
        ) : (
          "Record Adjustment"
        )}
      </Button>
    </form>
  );
}
