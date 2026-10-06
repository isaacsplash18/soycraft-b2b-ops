import Link from "next/link";
import { getOtherSubCategories } from "../actions";
import { CategoriesManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getOtherSubCategories();
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">
          Finance
        </Link>
        <span>/</span>
        <span className="text-foreground">Categories</span>
      </nav>

      <h1 className="text-2xl font-semibold">Other Sub-categories</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Manage the list of sub-categories that appear under the &quot;Other&quot;
        finance category. Removing one will hide it from the picker but keep
        existing entries intact.
      </p>

      <CategoriesManager categories={categories} />
    </div>
  );
}
