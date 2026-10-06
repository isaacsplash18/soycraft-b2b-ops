"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createDeliveryOrder,
  updateDeliveryOrder,
  getRetailerProducts,
  generateDoNumber,
  getRetailerOutlets,
  findSimilarDeliveryOrders,
} from "@/app/(admin)/delivery-orders/actions";
import type { CreateDoInput, UpdateDoInput } from "@/app/(admin)/delivery-orders/actions";
import {
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";

type OutletOption = { id: string; name: string; code: string };
type Retailer = { id: string; name: string; type: string; outlets?: OutletOption[] };
type ProductOption = {
  id: string;
  skuCode: string;
  name: string;
  unitPrice: number | null;
};

type LineItem = {
  key: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  agreedPrice: number | null;
};

type DeliveryOrderForEdit = {
  id: string;
  doNumber: string;
  retailerId: string;
  outletId: string | null;
  orderDate: Date | string;
  deliveryDate: Date | string | null;
  notes: string | null;
  sourceReference: string | null;
  status: string;
  lineItems: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number | string | { toString(): string };
    product: { id: string; skuCode: string; name: string };
  }[];
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

function dateToStr(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

let keyCounter = 0;
function nextKey() {
  return `li-${++keyCounter}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DOFormProps {
  retailers: Retailer[];
  deliveryOrder?: DeliveryOrderForEdit;
}

export function DOForm({ retailers, deliveryOrder }: DOFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditMode = !!deliveryOrder;

  const [retailerId, setRetailerId] = useState(deliveryOrder?.retailerId ?? "");
  const [outletId, setOutletId] = useState(deliveryOrder?.outletId ?? "");
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [doNumber, setDoNumber] = useState(deliveryOrder?.doNumber ?? "");
  const [loadingDoNumber, setLoadingDoNumber] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (deliveryOrder?.lineItems?.length) {
      return deliveryOrder.lineItems.map((li) => ({
        key: nextKey(),
        productId: li.productId,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
        agreedPrice: null,
      }));
    }
    return [{ key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null }];
  });
  const [orderDate, setOrderDate] = useState(
    deliveryOrder ? dateToStr(deliveryOrder.orderDate) : todayStr()
  );
  const [deliveryDate, setDeliveryDate] = useState(
    deliveryOrder ? dateToStr(deliveryOrder.deliveryDate) : ""
  );
  const [notes, setNotes] = useState(deliveryOrder?.notes ?? "");
  const [sourceReference, setSourceReference] = useState(deliveryOrder?.sourceReference ?? "");
  const [globalError, setGlobalError] = useState<string>();
  const [similarDos, setSimilarDos] = useState<{ doNumber: string; id: string }[]>([]);

  // Warn (non-blocking) when a DO already exists for the same retailer/outlet
  // on the same order date — the most common intern double-entry.
  useEffect(() => {
    if (!retailerId || !orderDate) {
      setSimilarDos([]);
      return;
    }
    let cancelled = false;
    findSimilarDeliveryOrders({
      retailerId,
      outletId: outletId || null,
      orderDate,
      excludeId: deliveryOrder?.id,
    })
      .then((r) => {
        if (!cancelled) setSimilarDos(r);
      })
      .catch(() => {
        if (!cancelled) setSimilarDos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [retailerId, outletId, orderDate, deliveryOrder?.id]);

  // Load outlets from retailer data or fetch them
  useEffect(() => {
    if (!retailerId) {
      setOutlets([]);
      return;
    }
    // Check if retailers prop already has outlets
    const retailer = retailers.find((r) => r.id === retailerId);
    if (retailer?.outlets) {
      setOutlets(retailer.outlets);
    } else {
      // Fetch outlets
      getRetailerOutlets(retailerId).then(setOutlets).catch(() => setOutlets([]));
    }
  }, [retailerId, retailers]);

  // Load products on mount for edit mode
  useEffect(() => {
    if (isEditMode && retailerId) {
      setLoadingProducts(true);
      getRetailerProducts(retailerId)
        .then((prods) => {
          setProducts(prods);
          // Update agreed prices for existing line items
          setLineItems((prev) =>
            prev.map((li) => {
              const prod = prods.find((p: ProductOption) => p.id === li.productId);
              return { ...li, agreedPrice: prod?.unitPrice ?? null };
            })
          );
        })
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate DO number when retailer or outlet changes (only in create mode)
  const fetchDoNumber = useCallback(
    async (rid: string, oid?: string) => {
      if (isEditMode || !rid) return;
      setLoadingDoNumber(true);
      try {
        const num = await generateDoNumber(rid, oid || undefined);
        setDoNumber(num);
      } catch {
        setDoNumber("");
      } finally {
        setLoadingDoNumber(false);
      }
    },
    [isEditMode]
  );

  // Fetch products when retailer changes
  const handleRetailerChange = useCallback(
    async (newRetailerId: string) => {
      setRetailerId(newRetailerId);
      setOutletId("");
      setLineItems([
        { key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null },
      ]);

      if (!newRetailerId) {
        setProducts([]);
        setDoNumber("");
        return;
      }

      setLoadingProducts(true);
      try {
        const prods = await getRetailerProducts(newRetailerId);
        setProducts(prods);
      } catch {
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }

      // Generate DO number
      fetchDoNumber(newRetailerId);
    },
    [fetchDoNumber]
  );

  // Handle outlet change
  const handleOutletChange = useCallback(
    (newOutletId: string) => {
      setOutletId(newOutletId);
      if (!isEditMode) {
        fetchDoNumber(retailerId, newOutletId || undefined);
      }
    },
    [retailerId, isEditMode, fetchDoNumber]
  );

  // Line item helpers
  const addRow = () => {
    setLineItems((prev) => [
      ...prev,
      { key: nextKey(), productId: "", quantity: 1, unitPrice: 0, agreedPrice: null },
    ]);
  };

  const removeRow = (key: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  };

  const updateLineItem = (key: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.key !== key) return li;
        const updated = { ...li, [field]: value };

        // When product changes, auto-populate price
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

  // Subtotal
  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );

  // Submit (create mode)
  const handleSubmit = (saveAs: "DRAFT" | "CONFIRMED") => {
    setGlobalError(undefined);

    const data: CreateDoInput = {
      retailerId,
      outletId: outletId || undefined,
      doNumber: doNumber || undefined,
      orderDate: new Date(orderDate),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      notes: notes || undefined,
      sourceReference: sourceReference || undefined,
      status: saveAs,
      lineItems: lineItems
        .filter((li) => li.productId)
        .map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
    };

    startTransition(async () => {
      const result = await createDeliveryOrder(data);
      if (result.success && result.deliveryOrderId) {
        router.push(`/delivery-orders/${result.deliveryOrderId}`);
      } else {
        setGlobalError(result.error || "Validation failed. Check all fields.");
      }
    });
  };

  // Submit (edit mode)
  const handleSaveChanges = () => {
    if (!deliveryOrder) return;
    setGlobalError(undefined);

    const data: UpdateDoInput = {
      doNumber: doNumber || undefined,
      orderDate: new Date(orderDate),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      notes: notes || undefined,
      sourceReference: sourceReference || undefined,
      lineItems: lineItems
        .filter((li) => li.productId)
        .map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
    };

    startTransition(async () => {
      const result = await updateDeliveryOrder(deliveryOrder.id, data);
      if (result.success && result.deliveryOrderId) {
        router.push(`/delivery-orders/${result.deliveryOrderId}`);
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

      {similarDos.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              Possible duplicate — {similarDos.length === 1 ? "a DO" : "DOs"}{" "}
              already exist{similarDos.length === 1 ? "s" : ""} for this{" "}
              {outletId ? "outlet" : "retailer"} on {orderDate}:
            </p>
            <p className="mt-0.5">
              {similarDos.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <a
                    href={`/delivery-orders/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    {d.doNumber}
                  </a>
                </span>
              ))}
              . You can still save if this is intentional.
            </p>
          </div>
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
          disabled={isEditMode}
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
            onChange={(e) => handleOutletChange(e.target.value)}
            className="flex h-9 w-full max-w-md rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={isEditMode}
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

      {/* DO Number */}
      {retailerId && (
        <div className="space-y-1.5">
          <Label htmlFor="doNumber">DO Number</Label>
          <div className="flex items-center gap-2 max-w-md">
            <Input
              id="doNumber"
              value={doNumber}
              onChange={(e) => setDoNumber(e.target.value)}
              placeholder="Auto-generated..."
              className="font-mono"
            />
            {loadingDoNumber && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {isEditMode ? "Edit to change DO number." : "Auto-generated. Edit to override."}
          </p>
        </div>
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
                    {lineItems.map((li) => {
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
                                updateLineItem(li.key, "productId", e.target.value)
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
                                updateLineItem(
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
                                  updateLineItem(
                                    li.key,
                                    "unitPrice",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-8 w-28"
                              />
                              {priceDiffers && (
                                <span title={`Agreed price: ${formatSGD(li.agreedPrice!)}`}>
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
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-3.5" />
                  Add Row
                </Button>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Subtotal: </span>
                  <span className="text-lg font-semibold">{formatSGD(subtotal)}</span>
                </div>
              </div>
            </>
          )}
        </fieldset>
      )}

      {/* Order Details */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Order Details</legend>
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
          <div className="space-y-1.5">
            <Label htmlFor="orderDate">Order Date *</Label>
            <Input
              id="orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliveryDate">Delivery Date</Label>
            <Input
              id="deliveryDate"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5 max-w-2xl">
          <Label htmlFor="sourceReference">Source Reference</Label>
          <Input
            id="sourceReference"
            value={sourceReference}
            onChange={(e) => setSourceReference(e.target.value)}
            placeholder="e.g. PO-2024-001"
          />
        </div>
        <div className="space-y-1.5 max-w-2xl">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Internal notes..."
          />
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex gap-3">
        {isEditMode ? (
          <>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleSaveChanges}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
