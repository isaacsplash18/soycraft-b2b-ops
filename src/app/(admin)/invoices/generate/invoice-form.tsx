"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvoice,
  updateInvoice,
  getRetailerProductsForInvoice,
  getRetailerOutletsForInvoice,
  generateInvoiceNumber,
  getGstRateForInvoice,
} from "../actions";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "../actions";
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
  paymentTerms: string | null;
  outlets: OutletOption[];
};
type ProductOption = {
  id: string;
  skuCode: string;
  name: string;
  unitPrice: number | null;
};

type ProductLineItem = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  agreedPrice: number | null;
};

type AdHocLineItem = {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

const formatSGD = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(value);

function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function parseDueDays(paymentTerms: string | null): number {
  if (!paymentTerms) return 30;
  const lower = paymentTerms.toLowerCase().trim();
  if (lower === "cod") return 0;
  const match = lower.match(/net\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 30;
}

let keyCounter = 0;
function nextKey() {
  return `li-${++keyCounter}`;
}

// ---------------------------------------------------------------------------
// Quick Entry Parser
// ---------------------------------------------------------------------------

function parseQuickEntry(
  text: string,
  products: ProductOption[]
): { productId: string; quantity: number; unitPrice: number }[] {
  const lines = text
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: { productId: string; quantity: number; unitPrice: number }[] =
    [];

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
        quantity: qty,
        unitPrice: found.unitPrice ?? 0,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type InvoiceEditInitial = {
  id: string;
  retailerId: string;
  outletId: string | null;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;
  sourceReference: string | null;
  notes: string | null;
  productLineItems: { productId: string; quantity: number; unitPrice: number }[];
  adHocLineItems: { description: string; quantity: number; unitPrice: number }[];
};

interface InvoiceFormProps {
  retailers: Retailer[];
  initial?: InvoiceEditInitial;
}

export function InvoiceForm({ retailers, initial }: InvoiceFormProps) {
  const router = useRouter();
  const isEditMode = !!initial;
  const [isPending, startTransition] = useTransition();

  // Form state
  const [retailerId, setRetailerId] = useState(initial?.retailerId ?? "");
  const [outletId, setOutletId] = useState(initial?.outletId ?? "");
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [loadingInvoiceNumber, setLoadingInvoiceNumber] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [gstRate, setGstRate] = useState(0.09);

  const [productLineItems, setProductLineItems] = useState<ProductLineItem[]>(
    initial && initial.productLineItems.length > 0
      ? initial.productLineItems.map((li) => ({
          key: nextKey(),
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          agreedPrice: null,
        }))
      : [{ key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null }]
  );
  const [adHocLineItems, setAdHocLineItems] = useState<AdHocLineItem[]>(
    initial?.adHocLineItems.map((li) => ({
      key: nextKey(),
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
    })) ?? []
  );
  const [quickText, setQuickText] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? todayStr());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? addDaysStr(todayStr(), 30));
  const [sourceReference, setSourceReference] = useState(initial?.sourceReference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [globalError, setGlobalError] = useState<string>();

  // In edit mode, load products & outlets for the existing retailer once
  useEffect(() => {
    if (!isEditMode || !initial) return;
    const retailer = retailers.find((r) => r.id === initial.retailerId);
    if (retailer?.outlets) setOutlets(retailer.outlets);
    else getRetailerOutletsForInvoice(initial.retailerId).then(setOutlets).catch(() => {});

    setLoadingProducts(true);
    getRetailerProductsForInvoice(initial.retailerId)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load GST rate on mount
  useEffect(() => {
    getGstRateForInvoice().then(setGstRate).catch(() => {});
  }, []);

  // Load outlets when retailer changes
  useEffect(() => {
    if (!retailerId) {
      setOutlets([]);
      return;
    }
    const retailer = retailers.find((r) => r.id === retailerId);
    if (retailer?.outlets) {
      setOutlets(retailer.outlets);
    } else {
      getRetailerOutletsForInvoice(retailerId)
        .then(setOutlets)
        .catch(() => setOutlets([]));
    }
  }, [retailerId, retailers]);

  // Auto-generate invoice number and set due date when retailer changes
  const handleRetailerChange = useCallback(
    async (newRetailerId: string) => {
      setRetailerId(newRetailerId);
      setOutletId("");
      setProductLineItems([
        { key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null },
      ]);
      setAdHocLineItems([]);

      if (!newRetailerId) {
        setProducts([]);
        setInvoiceNumber("");
        return;
      }

      // Update due date based on retailer payment terms
      const retailer = retailers.find((r) => r.id === newRetailerId);
      if (retailer) {
        const dueDays = parseDueDays(retailer.paymentTerms);
        setDueDate(addDaysStr(invoiceDate, dueDays));
      }

      // Load products
      setLoadingProducts(true);
      try {
        const prods = await getRetailerProductsForInvoice(newRetailerId);
        setProducts(prods);
      } catch {
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }

      // Generate invoice number
      setLoadingInvoiceNumber(true);
      try {
        const num = await generateInvoiceNumber();
        setInvoiceNumber(num);
      } catch {
        setInvoiceNumber("");
      } finally {
        setLoadingInvoiceNumber(false);
      }
    },
    [retailers, invoiceDate]
  );

  // Product line item helpers
  const addProductRow = () => {
    setProductLineItems((prev) => [
      ...prev,
      { key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null },
    ]);
  };

  const removeProductRow = (key: string) => {
    setProductLineItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)
    );
  };

  const updateProductLineItem = (
    key: string,
    field: keyof ProductLineItem,
    value: string | number
  ) => {
    setProductLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        const updated = { ...li, [field]: value };

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

  // Ad-hoc line item helpers
  const addAdHocRow = () => {
    setAdHocLineItems((prev) => [
      ...prev,
      { key: nextKey(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeAdHocRow = (key: string) => {
    setAdHocLineItems((prev) => prev.filter((li) => li.key !== key));
  };

  const updateAdHocLineItem = (
    key: string,
    field: keyof AdHocLineItem,
    value: string | number
  ) => {
    setAdHocLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        return { ...li, [field]: value };
      })
    );
  };

  // Quick entry parse
  const handleParseQuickEntry = () => {
    if (!quickText.trim() || products.length === 0) return;

    const parsed = parseQuickEntry(quickText, products);
    if (parsed.length === 0) return;

    const newItems: ProductLineItem[] = parsed.map((p) => {
      const prod = products.find((pr) => pr.id === p.productId);
      return {
        key: nextKey(),
        productId: p.productId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        agreedPrice: prod?.unitPrice ?? null,
      };
    });

    setProductLineItems(newItems);
    setQuickText("");
  };

  // Calculations
  const productSubtotal = productLineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );
  const adHocSubtotal = adHocLineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );
  const subtotal = productSubtotal + adHocSubtotal;
  const gstAmount = Number((subtotal * gstRate).toFixed(2));
  const total = Number((subtotal + gstAmount).toFixed(2));

  // Submit
  const handleSubmit = (saveAs: "DRAFT" | "CONFIRMED") => {
    setGlobalError(undefined);

    const base = {
      retailerId,
      outletId: outletId || undefined,
      invoiceNumber: invoiceNumber || undefined,
      sourceReference: sourceReference || undefined,
      invoiceDate: new Date(invoiceDate),
      dueDate: new Date(dueDate),
      notes: notes || undefined,
      productLineItems: productLineItems
        .filter((li) => li.productId)
        .map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
      adHocLineItems: adHocLineItems
        .filter((li) => li.description.trim())
        .map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
    };

    startTransition(async () => {
      if (isEditMode && initial) {
        const data: UpdateInvoiceInput = {
          ...base,
          id: initial.id,
          status: "DRAFT",
        };
        const result = await updateInvoice(data);
        if (result.success && result.invoiceId) {
          router.push(`/invoices/${result.invoiceId}`);
          router.refresh();
        } else {
          setGlobalError(result.error || "Validation failed. Check all fields.");
        }
      } else {
        const data: CreateInvoiceInput = { ...base, status: saveAs };
        const result = await createInvoice(data);
        if (result.success && result.invoiceId) {
          router.push(`/invoices/${result.invoiceId}`);
        } else {
          setGlobalError(result.error || "Validation failed. Check all fields.");
        }
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

      {/* Invoice Number */}
      {retailerId && (
        <div className="space-y-1.5">
          <Label htmlFor="invoiceNumber">Invoice Number</Label>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Auto-generated..."
              className="font-mono"
            />
            {loadingInvoiceNumber && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-generated. Edit to override.
          </p>
        </div>
      )}

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
            placeholder={`Paste or type naturally, e.g.\n5x Black Carrier M, 3x Grey Stroller\n10 Silken Tofu`}
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

      {/* Product Line Items */}
      {retailerId && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Product Line Items</legend>

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
                      <th className="px-3 py-2 text-left font-medium">Product</th>
                      <th className="px-3 py-2 text-left font-medium w-24">Qty</th>
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
                    {productLineItems.map((li) => {
                      const lineTotal = li.quantity * li.unitPrice;
                      const priceDiffers =
                        li.agreedPrice !== null &&
                        li.unitPrice !== li.agreedPrice;

                      return (
                        <tr key={li.key} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <select
                              value={li.productId}
                              onChange={(e) =>
                                updateProductLineItem(
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
                              value={li.quantity}
                              onChange={(e) =>
                                updateProductLineItem(
                                  li.key,
                                  "quantity",
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
                                  updateProductLineItem(
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
                              onClick={() => removeProductRow(li.key)}
                              disabled={productLineItems.length <= 1}
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
                  onClick={addProductRow}
                >
                  <Plus className="size-3.5" />
                  Add Row
                </Button>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">
                    Products subtotal:{" "}
                  </span>
                  <span className="font-semibold">
                    {formatSGD(productSubtotal)}
                  </span>
                </div>
              </div>
            </>
          )}
        </fieldset>
      )}

      {/* Ad-hoc Line Items */}
      {retailerId && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">
            Additional Items{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (discounts, delivery fees, etc.)
            </span>
          </legend>

          {adHocLineItems.length > 0 && (
            <div className="rounded-lg border border-dashed">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-pink-50/50 dark:bg-pink-900/10">
                    <th className="px-3 py-2 text-left font-medium">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left font-medium w-24">Qty</th>
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
                  {adHocLineItems.map((li) => {
                    const lineTotal = li.quantity * li.unitPrice;
                    return (
                      <tr key={li.key} className="border-b last:border-b-0">
                        <td className="px-3 py-2">
                          <Input
                            value={li.description}
                            onChange={(e) =>
                              updateAdHocLineItem(
                                li.key,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="e.g. Discount, Delivery Fee..."
                            className="h-8"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={1}
                            value={li.quantity}
                            onChange={(e) =>
                              updateAdHocLineItem(
                                li.key,
                                "quantity",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="h-8 w-20"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={li.unitPrice}
                            onChange={(e) =>
                              updateAdHocLineItem(
                                li.key,
                                "unitPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="Negative for discounts"
                            className="h-8 w-28"
                          />
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            lineTotal < 0 ? "text-red-600" : ""
                          }`}
                        >
                          {formatSGD(lineTotal)}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAdHocRow(li.key)}
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
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAdHocRow}
          >
            <Plus className="size-3.5" />
            Add Additional Item
          </Button>

          {adHocLineItems.length > 0 && adHocSubtotal !== 0 && (
            <div className="text-right">
              <span className="text-sm text-muted-foreground">
                Additional items subtotal:{" "}
              </span>
              <span
                className={`font-semibold ${
                  adHocSubtotal < 0 ? "text-red-600" : ""
                }`}
              >
                {formatSGD(adHocSubtotal)}
              </span>
            </div>
          )}
        </fieldset>
      )}

      {/* Invoice Details */}
      {retailerId && (
        <fieldset className="space-y-4">
          <legend className="text-lg font-semibold">Invoice Details</legend>
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="invoiceDate">Invoice Date *</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  // Recalculate due date
                  const retailer = retailers.find((r) => r.id === retailerId);
                  if (retailer) {
                    const dueDays = parseDueDays(retailer.paymentTerms);
                    setDueDate(addDaysStr(e.target.value, dueDays));
                  }
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5 max-w-2xl">
            <Label htmlFor="sourceReference">PO Reference</Label>
            <Input
              id="sourceReference"
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              placeholder="e.g. PO-2026-001"
            />
          </div>
          <div className="space-y-1.5 max-w-2xl">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes or terms..."
            />
          </div>
        </fieldset>
      )}

      {/* Financial Summary */}
      {retailerId && (
        <div className="flex justify-end">
          <div className="min-w-[320px] rounded-xl border bg-gradient-to-br from-orange-50/60 to-transparent px-6 py-5 shadow-sm dark:from-orange-950/20">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatSGD(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  GST ({(gstRate * 100).toFixed(0)}%)
                </span>
                <span className="tabular-nums">{formatSGD(gstAmount)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t pt-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Due
              </span>
              <span className="text-3xl font-semibold tabular-nums text-primary">
                {formatSGD(total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {retailerId && (
        <div className="flex gap-3">
          {isEditMode ? (
            <Button
              type="button"
              disabled={isPending}
              onClick={() => handleSubmit("DRAFT")}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          ) : (
            <>
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
                onClick={() => handleSubmit("CONFIRMED")}
                className="bg-primary hover:bg-primary/90"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Confirm &amp; Generate
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
