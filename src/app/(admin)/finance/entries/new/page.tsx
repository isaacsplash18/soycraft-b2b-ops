import Link from "next/link";
import { getSuppliersForPicker, getOtherSubCategories } from "../../actions";
import { FinanceEntryForm } from "@/components/finance/finance-entry-form";

export const dynamic = "force-dynamic";

export default async function NewFinanceEntryPage() {
  const [suppliers, otherCategories] = await Promise.all([
    getSuppliersForPicker(),
    getOtherSubCategories(),
  ]);

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
        <span className="text-foreground">New</span>
      </nav>

      <h1 className="text-2xl font-semibold">New Finance Entry</h1>

      <FinanceEntryForm suppliers={suppliers} otherCategories={otherCategories} />
    </div>
  );
}
