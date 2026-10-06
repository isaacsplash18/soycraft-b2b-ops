"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitSellThrough } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

interface InventoryItem {
  productId: string;
  skuCode: string;
  name: string;
  currentStock: number;
  unitPrice: number;
}

interface SellThroughFormProps {
  token: string;
  retailerId: string;
  retailerName: string;
  inventory: InventoryItem[];
}

export function SellThroughForm({
  token,
  retailerId,
  retailerName,
  inventory,
}: SellThroughFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to current month
  const now = new Date();
  const defaultMonth = format(now, "yyyy-MM");
  const [month, setMonth] = useState(defaultMonth);

  // Track units sold per product
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(inventory.map((item) => [item.productId, 0]))
  );

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const handleQuantityChange = (productId: string, value: string) => {
    const num = parseInt(value, 10);
    const qty = isNaN(num) ? 0 : Math.max(0, num);
    setQuantities((prev) => ({ ...prev, [productId]: qty }));

    // Clear validation error
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    let hasItems = false;

    for (const item of inventory) {
      const qty = quantities[item.productId] ?? 0;
      if (qty > 0) hasItems = true;
      if (qty > item.currentStock) {
        errors[item.productId] = `Cannot exceed stock of ${item.currentStock}`;
      }
    }

    if (!hasItems) {
      setError("Please enter at least one product with units sold.");
      return false;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    setError(null);
    if (!validate()) return;

    startTransition(async () => {
      const items = inventory
        .filter((item) => (quantities[item.productId] ?? 0) > 0)
        .map((item) => ({
          productId: item.productId,
          quantitySold: quantities[item.productId],
        }));

      const result = await submitSellThrough(retailerId, month, items);

      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.error || "Failed to submit report");
      }
    });
  };

  // Calculate total
  const total = inventory.reduce((sum, item) => {
    const qty = quantities[item.productId] ?? 0;
    return sum + qty * item.unitPrice;
  }, 0);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">
          Report Submitted!
        </h1>
        <p className="mt-2 text-muted-foreground max-w-md">
          Your sell-through report for{" "}
          {format(new Date(month + "-01"), "MMMM yyyy")} has been submitted
          successfully. Soycraft will review it shortly.
        </p>
        <Button
          className="mt-6 bg-primary hover:bg-primary/90"
          asChild
        >
          <Link href={`/r/${token}`}>
            Back to Portal
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/r/${token}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Portal
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Report Sell-Through
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{retailerName}</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Reporting Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Products table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="w-32 text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => {
                  const qty = quantities[item.productId] ?? 0;
                  const lineTotal = qty * item.unitPrice;
                  const hasError = !!validationErrors[item.productId];

                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        {item.skuCode}
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.currentStock}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSGD(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <Input
                            type="number"
                            min={0}
                            max={item.currentStock}
                            value={qty || ""}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.productId,
                                e.target.value
                              )
                            }
                            className={`w-20 text-right ml-auto ${
                              hasError ? "border-red-400" : ""
                            }`}
                          />
                          {hasError && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {validationErrors[item.productId]}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {qty > 0 ? formatSGD(lineTotal) : "\u2014"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Total and Submit */}
          <div className="mt-4 flex items-center justify-between">
            <div className="rounded-lg border px-4 py-2">
              <span className="text-sm text-muted-foreground">Total: </span>
              <span className="text-lg font-semibold">{formatSGD(total)}</span>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
