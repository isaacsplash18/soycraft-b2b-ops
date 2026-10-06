"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  createSupplierOrder,
  updateSupplierOrder,
  quickCreateProduct,
  type ActionResult,
  type CreateSupplierOrderInput,
} from "@/app/(admin)/supplier-orders/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Supplier = { id: string; name: string; code: string };
type Product = { id: string; skuCode: string; name: string };

type LineKind = "PRODUCT" | "OTHER";

type LineItem = {
  kind: LineKind;
  productId: string;
  description: string;
  orderedQty: number;
  unitCost: number;
};

export type SupplierOrderInitialLine = {
  productId: string | null;
  description: string | null;
  orderedQty: number;
  unitCost: number;
};

export type SupplierOrderInitial = {
  id: string;
  supplierId: string;
  soNumber: string;
  orderDate: string; // yyyy-mm-dd
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  status: "ORDERED" | "IN_TRANSIT";
  lineItems: SupplierOrderInitialLine[];
};

function emptyLine(): LineItem {
  return {
    kind: "PRODUCT",
    productId: "",
    description: "",
    orderedQty: 1,
    unitCost: 0,
  };
}

function hydrateLine(li: SupplierOrderInitialLine): LineItem {
  return {
    kind: li.productId ? "PRODUCT" : "OTHER",
    productId: li.productId ?? "",
    description: li.description ?? "",
    orderedQty: li.orderedQty,
    unitCost: li.unitCost,
  };
}

interface Props {
  suppliers: Supplier[];
  products: Product[];
  initial?: SupplierOrderInitial;
  /** When false, cost inputs + line totals + subtotal are hidden (staff role). */
  allowCosts?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export function SupplierOrderForm({
  suppliers,
  products: initialProducts,
  initial,
  allowCosts = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);

  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [soNumber, setSoNumber] = useState(initial?.soNumber ?? "");
  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? today());
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDeliveryDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<"ORDERED" | "IN_TRANSIT">(
    initial?.status ?? "ORDERED"
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initial?.lineItems?.map(hydrateLine) ?? [emptyLine()],
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + li.orderedQty * li.unitCost, 0),
    [lineItems]
  );

  function setLine(idx: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLineItems((p) => [...p, emptyLine()]);
  }
  function setLineKind(idx: number, kind: LineKind) {
    setLineItems((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              kind,
              // Clear the field that no longer applies so we never submit both.
              productId: kind === "PRODUCT" ? l.productId : "",
              description: kind === "OTHER" ? l.description : "",
            }
          : l,
      ),
    );
  }
  function removeLine(idx: number) {
    setLineItems((p) => p.filter((_, i) => i !== idx));
  }

  function handleProductCreated(p: Product) {
    setProducts((prev) => [...prev, p].sort((a, b) => a.skuCode.localeCompare(b.skuCode)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(undefined);

    const data: CreateSupplierOrderInput = {
      supplierId,
      soNumber: soNumber || undefined,
      orderDate: new Date(orderDate),
      expectedDeliveryDate: expectedDate ? new Date(expectedDate) : null,
      notes: notes || undefined,
      status,
      lineItems: lineItems.map((li) => ({
        productId: li.kind === "PRODUCT" ? li.productId : null,
        description: li.kind === "OTHER" ? li.description.trim() : null,
        orderedQty: li.orderedQty,
        unitCost: li.unitCost,
      })),
    };

    startTransition(async () => {
      const result: ActionResult = initial
        ? await updateSupplierOrder({ ...data, id: initial.id })
        : await createSupplierOrder(data);
      if (result.success) {
        router.push(
          result.supplierOrderId
            ? `/supplier-orders/${result.supplierOrderId}`
            : "/supplier-orders"
        );
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.error) setGlobalError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {globalError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {globalError}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Order Details</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="supplierId">Supplier *</Label>
            <select
              id="supplierId"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <FieldError errors={fieldErrors.supplierId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="soNumber">SO Number</Label>
            <Input
              id="soNumber"
              value={soNumber}
              onChange={(e) => setSoNumber(e.target.value)}
              placeholder="Auto-generate on save"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-generate (#SO-CODE-YEARNNN)
            </p>
            <FieldError errors={fieldErrors.soNumber} />
          </div>

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
            <Label htmlFor="expectedDate">Expected Delivery</Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate ?? ""}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "ORDERED" | "IN_TRANSIT")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ORDERED">Ordered</option>
              <option value="IN_TRANSIT">In Transit</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between">
          <legend className="text-lg font-semibold">Line Items</legend>
          <QuickProductDialog onCreated={handleProductCreated} />
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-32">Qty</TableHead>
                {allowCosts && (
                  <TableHead className="w-36">Unit Cost</TableHead>
                )}
                {allowCosts && (
                  <TableHead className="w-32 text-right">Line Total</TableHead>
                )}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.map((li, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <select
                      value={li.kind}
                      onChange={(e) => setLineKind(idx, e.target.value as LineKind)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      aria-label="Line type"
                    >
                      <option value="PRODUCT">Product</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    {li.kind === "PRODUCT" ? (
                      <select
                        value={li.productId}
                        onChange={(e) => setLine(idx, { productId: e.target.value })}
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.skuCode} — {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={li.description}
                        onChange={(e) => setLine(idx, { description: e.target.value })}
                        required
                        placeholder="e.g. Packaging, freight, courier fees"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={li.orderedQty}
                      onChange={(e) =>
                        setLine(idx, { orderedQty: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  {allowCosts && (
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.unitCost}
                        onChange={(e) =>
                          setLine(idx, { unitCost: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                  )}
                  {allowCosts && (
                    <TableCell className="text-right font-medium">
                      {(li.orderedQty * li.unitCost).toFixed(2)}
                    </TableCell>
                  )}
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(idx)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {allowCosts && (
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="size-3.5" /> Add Line
        </Button>
        <FieldError errors={fieldErrors.lineItems} />
      </fieldset>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-primary hover:bg-primary/90"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Save Changes" : "Create Supplier Order"}
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

function QuickProductDialog({
  onCreated,
}: {
  onCreated: (p: { id: string; skuCode: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [skuCode, setSkuCode] = useState("");
  const [name, setName] = useState("");
  const [msrp, setMsrp] = useState("0");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalErr, setGlobalErr] = useState<string>();

  function submit() {
    setErrors({});
    setGlobalErr(undefined);
    startTransition(async () => {
      const res = await quickCreateProduct({
        skuCode,
        name,
        msrp: Number(msrp) || 0,
      });
      if (res.success && res.product) {
        onCreated(res.product);
        setOpen(false);
        setSkuCode("");
        setName("");
        setMsrp("0");
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        if (res.error) setGlobalErr(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Plus className="size-3.5" /> New Product
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {globalErr && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {globalErr}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="qp-sku">SKU Code *</Label>
            <Input
              id="qp-sku"
              value={skuCode}
              onChange={(e) => setSkuCode(e.target.value)}
            />
            <FieldError errors={errors.skuCode} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qp-name">Name *</Label>
            <Input
              id="qp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError errors={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qp-msrp">MSRP</Label>
            <Input
              id="qp-msrp"
              type="number"
              min={0}
              step="0.01"
              value={msrp}
              onChange={(e) => setMsrp(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending}
            className="bg-primary hover:bg-primary/90"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
