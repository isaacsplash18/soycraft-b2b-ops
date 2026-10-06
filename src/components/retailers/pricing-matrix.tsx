"use client";

import { useState, useTransition } from "react";
import { upsertRetailerPrice } from "@/app/(admin)/retailers/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Check } from "lucide-react";

type PricingRow = {
  productId: string;
  skuCode: string;
  productName: string;
  msrp: number;
  unitPrice: number | null;
  pricingId: string | null;
};

const formatSGD = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(value);

function marginColor(margin: number): string {
  if (margin >= 40) return "text-emerald-600 dark:text-emerald-400";
  if (margin >= 20) return "text-pink-600 dark:text-pink-400";
  return "text-red-600 dark:text-red-400";
}

interface PricingMatrixProps {
  retailerId: string;
  initialData: PricingRow[];
}

export function PricingMatrix({ retailerId, initialData }: PricingMatrixProps) {
  const [data, setData] = useState(initialData);
  const [editValues, setEditValues] = useState<Record<string, { price: string; margin: string }>>(() => {
    const map: Record<string, { price: string; margin: string }> = {};
    for (const row of initialData) {
      if (row.unitPrice !== null) {
        const margin = row.msrp > 0 ? ((row.msrp - row.unitPrice) / row.msrp) * 100 : 0;
        map[row.productId] = {
          price: row.unitPrice.toString(),
          margin: margin.toFixed(1),
        };
      } else {
        map[row.productId] = { price: "", margin: "" };
      }
    }
    return map;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Pricing Matrix</h2>
      <p className="text-sm text-muted-foreground">
        Set retailer-specific prices for each product. Edit the price or margin
        — the other will auto-calculate.
      </p>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU Code</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-right">MSRP</TableHead>
              <TableHead className="text-right">Retailer Price</TableHead>
              <TableHead className="text-right">Margin %</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <PricingRowComponent
                key={row.productId}
                row={row}
                retailerId={retailerId}
                editValue={editValues[row.productId] ?? { price: "", margin: "" }}
                onEditChange={(val) =>
                  setEditValues((prev) => ({
                    ...prev,
                    [row.productId]: val,
                  }))
                }
                onSaved={(newPrice) => {
                  setData((prev) =>
                    prev.map((r) =>
                      r.productId === row.productId
                        ? { ...r, unitPrice: newPrice }
                        : r
                    )
                  );
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PricingRowComponent({
  row,
  retailerId,
  editValue,
  onEditChange,
  onSaved,
}: {
  row: PricingRow;
  retailerId: string;
  editValue: { price: string; margin: string };
  onEditChange: (val: { price: string; margin: string }) => void;
  onSaved: (newPrice: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const priceNum = parseFloat(editValue.price);
  const hasValidPrice = !isNaN(priceNum) && priceNum > 0;

  const hasPricing = row.unitPrice !== null;

  // When price changes → recalculate margin
  function handlePriceChange(val: string) {
    const p = parseFloat(val);
    if (!isNaN(p) && row.msrp > 0) {
      const m = ((row.msrp - p) / row.msrp) * 100;
      onEditChange({ price: val, margin: m.toFixed(1) });
    } else {
      onEditChange({ price: val, margin: "" });
    }
  }

  // When margin changes → recalculate price
  function handleMarginChange(val: string) {
    const m = parseFloat(val);
    if (!isNaN(m) && row.msrp > 0) {
      const p = row.msrp * (1 - m / 100);
      onEditChange({ price: p.toFixed(2), margin: val });
    } else {
      onEditChange({ price: "", margin: val });
    }
  }

  function handleSave() {
    if (!hasValidPrice) return;
    setSaved(false);
    startTransition(async () => {
      const result = await upsertRetailerPrice(
        retailerId,
        row.productId,
        priceNum
      );
      if (result.success) {
        onSaved(priceNum);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <TableRow className={hasPricing ? "bg-primary/5" : ""}>
      <TableCell className="font-medium">{row.skuCode}</TableCell>
      <TableCell>{row.productName}</TableCell>
      <TableCell className="text-right">{formatSGD(row.msrp)}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Set price"
          className="ml-auto w-28 text-right"
          value={editValue.price}
          onChange={(e) => handlePriceChange(e.target.value)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Input
            type="number"
            step="0.1"
            placeholder="%"
            className={`w-20 text-right ${hasValidPrice ? marginColor(parseFloat(editValue.margin) || 0) : ""}`}
            value={editValue.margin}
            onChange={(e) => handleMarginChange(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          disabled={isPending || !hasValidPrice}
          onClick={handleSave}
          className={
            saved
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-primary hover:bg-primary/90"
          }
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : saved ? (
            <Check className="size-3" />
          ) : (
            "Save"
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}
