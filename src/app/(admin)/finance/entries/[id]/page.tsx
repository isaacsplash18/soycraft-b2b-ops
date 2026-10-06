import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getFinanceEntry,
  getSuppliersForPicker,
  getOtherSubCategories,
} from "../../actions";
import { FinanceEntryForm } from "@/components/finance/finance-entry-form";
import { DeleteEntryButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function EditFinanceEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [entry, suppliers, otherCategories] = await Promise.all([
    getFinanceEntry(id),
    getSuppliersForPicker(),
    getOtherSubCategories(),
  ]);
  if (!entry) notFound();

  const lockedFromSO = !!entry.supplierOrderId;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">
          Finance
        </Link>
        <span>/</span>
        <Link href="/finance/entries" className="hover:text-foreground">
          Entries
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Finance Entry</h1>
        <DeleteEntryButton id={entry.id} />
      </div>

      <FinanceEntryForm
        suppliers={suppliers}
        otherCategories={otherCategories}
        lockedInventoryFromSO={lockedFromSO}
        initial={{
          id: entry.id,
          category: entry.category,
          entryDate: new Date(entry.entryDate).toISOString().slice(0, 10),
          amount: Number(entry.amount),
          description: entry.description,
          notes: entry.notes,
          supplierId: entry.supplierId,
          supplierOrderId: entry.supplierOrderId,
          eventName: entry.eventName,
          eventSubCategory: entry.eventSubCategory,
          otherSubCategoryId: entry.otherSubCategoryId,
        }}
      />
    </div>
  );
}
