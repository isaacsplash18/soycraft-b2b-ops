"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  createFinanceEntry,
  updateFinanceEntry,
  type ActionResult,
} from "@/app/(admin)/finance/actions";

type Supplier = { id: string; name: string };
type OtherCat = { id: string; name: string };

type Category = "INVENTORY" | "EVENT" | "OTHER";
type EventSub = "BOOTH_FEE" | "LOGISTICS" | "TRAVEL" | "MARKETING" | "OTHER";

export type FinanceEntryInitial = {
  id: string;
  category: Category;
  entryDate: string;
  amount: number;
  description: string | null;
  notes: string | null;
  supplierId: string | null;
  supplierOrderId: string | null;
  eventName: string | null;
  eventSubCategory: EventSub | null;
  otherSubCategoryId: string | null;
};

interface Props {
  suppliers: Supplier[];
  otherCategories: OtherCat[];
  initial?: FinanceEntryInitial;
  // Whether this entry was auto-created from a delivered SO. If so, lock category + supplier.
  lockedInventoryFromSO?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export function FinanceEntryForm({
  suppliers,
  otherCategories,
  initial,
  lockedInventoryFromSO,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [category, setCategory] = useState<Category>(initial?.category ?? "OTHER");
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? today());
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount) : "0"
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [eventName, setEventName] = useState(initial?.eventName ?? "");
  const [eventSubCategory, setEventSubCategory] = useState<EventSub>(
    initial?.eventSubCategory ?? "BOOTH_FEE"
  );
  const [otherSubCategoryId, setOtherSubCategoryId] = useState(
    initial?.otherSubCategoryId ?? ""
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError(undefined);

    const data = {
      category,
      entryDate: new Date(entryDate),
      amount: Number(amount),
      description: description || undefined,
      notes: notes || undefined,
      supplierId: category === "INVENTORY" ? supplierId || null : null,
      supplierOrderId: initial?.supplierOrderId ?? null,
      eventName: category === "EVENT" ? eventName || null : null,
      eventSubCategory: category === "EVENT" ? eventSubCategory : null,
      otherSubCategoryId:
        category === "OTHER" ? otherSubCategoryId || null : null,
    };

    startTransition(async () => {
      const result: ActionResult = initial
        ? await updateFinanceEntry({ ...data, id: initial.id })
        : await createFinanceEntry(data);
      if (result.success) {
        router.push("/finance/entries");
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.error) setGlobalError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {globalError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {globalError}
        </div>
      )}

      {lockedInventoryFromSO && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          This entry was auto-created from a delivered Supplier Order. The
          category and supplier link are locked.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category *</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={lockedInventoryFromSO}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="INVENTORY">Inventory</option>
            <option value="EVENT">Event</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="entryDate">Date *</Label>
          <Input
            id="entryDate"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (SGD) *</Label>
          <Input
            id="amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <FieldError errors={fieldErrors.amount} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {category === "INVENTORY" && (
        <div className="space-y-1.5">
          <Label htmlFor="supplierId">Supplier</Label>
          <select
            id="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={lockedInventoryFromSO}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">— None —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {category === "EVENT" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Pet Expo 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eventSub">Sub-category</Label>
            <select
              id="eventSub"
              value={eventSubCategory}
              onChange={(e) => setEventSubCategory(e.target.value as EventSub)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="BOOTH_FEE">Booth Fee</option>
              <option value="LOGISTICS">Logistics</option>
              <option value="TRAVEL">Travel</option>
              <option value="MARKETING">Marketing</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      )}

      {category === "OTHER" && (
        <div className="space-y-1.5">
          <Label htmlFor="otherSub">Sub-category</Label>
          <select
            id="otherSub"
            value={otherSubCategoryId}
            onChange={(e) => setOtherSubCategoryId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">— None —</option>
            {otherCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Manage sub-categories in Finance settings.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary hover:bg-primary/90"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {initial ? "Save Changes" : "Create Entry"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
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
