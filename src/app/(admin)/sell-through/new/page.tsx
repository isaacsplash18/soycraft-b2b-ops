import Link from "next/link";
import { getActiveRetailersWithOutlets } from "../actions";
import { STForm } from "@/components/sell-through/st-form";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewSellThroughPage() {
  const retailers = await getActiveRetailersWithOutlets();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/sell-through" className="hover:text-foreground">
          Sell-Through
        </Link>
        <span>/</span>
        <span className="text-foreground">Record Sell-Through</span>
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sell-through">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Record Sell-Through</h1>
      </div>

      <STForm retailers={retailers} />
    </div>
  );
}
