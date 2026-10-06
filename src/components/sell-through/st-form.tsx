"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createSellThrough,
  getRetailerProductsForST,
  getRetailerOutletsForST,
} from "@/app/(admin)/sell-through/actions";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

type OutletOption = { id: string; name: string; code: string };
type Retailer = {
  id: string;
  name: string;
  type: string;
  outlets?: OutletOption[];
};
type ProductOption = {
  id: string;
  skuCode: string;
  name: string;
  unitPrice: number | null;
};

type LineItem = {
  key: string;
  productId: string;
  quantitySold: number;
  unitPrice: number;
  agreedPrice: number | null;
};

const formatSGD = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(value);

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

let keyCounter = 0;
function nextKey() {
  return `st-${++keyCounter}`;
}

// ---------------------------------------------------------------------------
// Quick Entry Parser
// ---------------------------------------------------------------------------

function parseQuickEntry(
  text: string,
  products: ProductOption[]
): { productId: string; quantitySold: number; unitPrice: number }[] {
  const lines = text
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: {
    productId: string;
    quantitySold: number;
    unitPrice: number;
  }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!match) continue;

    const qty = parseInt(match[1], 10);
    const query = match[2].trim().toLowerCase();

    const found = products.find(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.skuCode.toLowerCase().includes(query) ||
        query.includes(p.name.toLowerCase()) ||
        query.includes(p.skuCode.toLowerCase())
    );

    if (found) {
      results.push({
        productId: found.id,
        quantitySold: qty,
        unitPrice: found.unitPrice ?? 0,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface STFormProps {
  retailers: Retailer[];
}

export function STForm({ retailers }: STFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [retailerId, setRetailerId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      key: nextKey(),
      productId: "",
      quantitySold: 1,
      unitPrice: 0,
      agreedPrice: null,
    },
  ]);
  const [quickText, setQuickText] = useState("");
  const [reportingMonth, setReportingMonth] = useState(todayMonth());
  const [globalError, setGlobalError] = useState<string>();

  // Load outlets from retailer data or fetch them
  useEffect(() => {
    if (!retailerId) {
      setOutlets([]);
      return;
    }
    const retailer = retailers.find((r) => r.id === retailerId);
    if (retailer?.outlets) {
      setOutlets(retailer.outlets);
    } else {
      getRetailerOutletsForST(retailerId)
        .then(setOutlets)
        .catch(() => setOutlets([]));
    }
  }, [retailerId, retailers]);

  // Fetch products when retailer changes
  const handleRetailerChange = useCallback(async (newRetailerId: string) => {
    setRetailerId(newRetailerId);
    setOutletId("");
    setLineItems([
      {
        key: nextKey(),
        productId: "",
        quantitySold: 1,
        unitPrice: 0,
        agreedPrice: null,
      },
    ]);

    if (!newRetailerId) {
      setProducts([]);
      return;
    }

    setLoadingProducts(true);
    try {
      const prods = await getRetailerProductsForST(newRetailerId);
      setProducts(prods);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Line item helpers
  const addRow = () => {
    setLineItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        productId: "",
        quantitySold: 1,
        unitPrice: 0,
        agreedPrice: null,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setLineItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)
    );
  };

  const updateLineItem = (
    key: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        const updated = { ...li, [field]: value };

        // When product changes, auto-populate price from retailer pricing
        if (field === "productId") {
          const prod = products.find((p) => p.id === value);
          if (prod) {
            updated.unitPrice = prod.unitPrice ?? 0;
            updated.agreedPrice = prod.unitPrice;
          }
        }
        return updated;
      })
    );
  };

  // Quick entry parse
  const handleParseQuickEntry = () => {
    if (!quickText.trim() || products.length === 0) return;

    const parsed = parseQuickEntry(quickText, products);
    if (parsed.length === 0) return;

    const newItems: LineItem[] = parsed.map((p) => {
      const prod = products.find((pr) => pr.id === p.productId);
      return {
        key: nextKey(),
        productId: p.productId,
        quantitySold: p.quantitySold,
        unitPrice: p.unitPrice,
        agreedPrice: prod?.unitPrice ?? null,
      };
    });

    setLineItems(newItems);
    setQuickText("");
  };

  // Subtotal
  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantitySold * li.unitPrice,
    0
  );

  // Submit
  const handleSubmit = (saveAs: "DRAFT" | "APPROVED") => {
    setGlobalError(undefined);

    const validItems = lineItems.filter((li) => li.productId);
    if (validItems.length === 0) {
      setGlobalError("At least one line item with a product is required.");
      return;
    }

    startTransition(async () => {
      const result = await createSellThrough({
        retailerId,
        outletId: outletId || undefined,
        reportingMonth,
        status: saveAs,
        lineItems: validItems.map((li) => ({
          productId: li.productId,
          quantitySold: li.quantitySold,
          unitPrice: li.unitPrice,
        })),
      });

      if (result.success && result.reportId) {
        router.push(`/sell-through/${result.reportId}`);
      } else {
        setGlobalError(result.error || "Validation failed. Check all fields.");
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {globalError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {globalError}
        </div>
      )}

      {/* Retailer */}
      <div className="space-y-1.5">
        <Label htmlFor="retailerId">Retailer *</Label>
        <select
          id="retailerId"
          value={retailerId}
          onChange={(e) => handleRetailerChange(e.target.value)}
          className="flex h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          required
        >
          <option value="">Select a retailer...</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.type === "BUYOUT" ? "Buy-out" : "Consignment"})
            </option>
          ))}
        </select>
      </div>

      {/* Outlet */}
      {retailerId && outlets.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="outletId">Outlet</Label>
          <select
            id="outletId"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="flex h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">No specific outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Reporting Month */}
      <div className="space-y-1.5">
        <Label htmlFor="reportingMonth">Reporting Month *</Label>
        <input
          id="reportingMonth"
          type="month"
          value={reportingMonth}
          onChange={(e) => setReportingMonth(e.target.value)}
          className="flex h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          required
        />
      </div>

      {/* Quick Entry */}
      {retailerId && (
        <fieldset className="space-y-3 rounded-lg border border-dashed p-4">
          <legend className="flex items-center gap-1.5 px-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary" />
            Quick Entry
          </legend>
          <Textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            placeholder={`Paste or type naturally, e.g.\n5x Silken Tofu, 3x Firm Tofu\n10 Soy Milk Original`}
            rows={3}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleParseQuickEntry}
            disabled={!quickText.trim() || products.length === 0}
          >
            <Sparkles className="size-3.5" />
            Parse Items
          </Button>
        </fieldset>
      )}

      {/* Line Items */}
      {retailerId && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Line Items</legend>

          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading products...
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">
                        Product
                      </th>
                      <th className="px-3 py-2 text-left font-medium w-24">
                        Qty Sold
                      </th>
                      <th className="px-3 py-2 text-left font-medium w-36">
                        Unit Price (SGD)
                      </th>
                      <th className="px-3 py-2 text-right font-medium w-32">
                        Line Total
                      </th>
                      <th className="px-3 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li) => {
                      const lineTotal = li.quantitySold * li.unitPrice;
                      const priceDiffers =
                        li.agreedPrice !== null &&
                        li.unitPrice !== li.agreedPrice;

                      return (
                        <tr key={li.key} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <select
                              value={li.productId}
                              onChange={(e) =>
                                updateLineItem(
                                  li.key,
                                  "productId",
                                  e.target.value
                                )
                              }
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <option value="">Select product...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.skuCode} - {p.name}
                                  {p.unitPrice !== null
                                    ? ` (${formatSGD(p.unitPrice)})`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={1}
                              value={li.quantitySold}
                              onChange={(e) =>
                                updateLineItem(
                                  li.key,
                                  "quantitySold",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="h-8 w-20"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={li.unitPrice}
                                onChange={(e) =>
                                  updateLineItem(
                                    li.key,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-8 w-28"
                              />
                              {priceDiffers && (
                                <span
                                  title={`Agreed price: ${formatSGD(li.agreedPrice!)}`}
                                >
                                  <AlertTriangle className="size-4 text-pink-500" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatSGD(lineTotal)}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(li.key)}
                              disabled={lineItems.length <= 1}
                              className="size-8 p-0"
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                >
                  <Plus className="size-3.5" />
                  Add Row
                </Button>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    Subtotal:{" "}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatSGD(subtotal)}
                  </span>
                </div>
              </div>
            </>
          )}
        </fieldset>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || !retailerId}
          onClick={() => handleSubmit("DRAFT")}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save as Draft
        </Button>
        <Button
          type="button"
          disabled={isPending || !retailerId}
          onClick={() => handleSubmit("APPROVED")}
          className="bg-primary hover:bg-primary/90"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Confirm &amp; Reduce Inventory
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
