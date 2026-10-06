import Link from "next/link";

export const dynamic = "force-dynamic";

import {
  getWarehouseStock,
  getRetailerStock,
  getLedgerEntries,
  getActiveProducts,
  getActiveRetailers,
} from "./actions";
import { WarehouseStock } from "@/components/inventory/warehouse-stock";
import { RetailerStock } from "@/components/inventory/retailer-stock";
import { LedgerView } from "@/components/inventory/ledger-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function InventoryPage() {
  const [warehouseStock, retailerStock, ledgerData, products, retailers] =
    await Promise.all([
      getWarehouseStock(),
      getRetailerStock(),
      getLedgerEntries({ page: 1, pageSize: 25 }),
      getActiveProducts(),
      getActiveRetailers(),
    ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Button asChild>
          <Link href="/inventory/adjustments">
            <Plus className="size-4" />
            Manual Adjustment
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="warehouse">
        <TabsList>
          <TabsTrigger value="warehouse">Warehouse</TabsTrigger>
          <TabsTrigger value="retailer">By Retailer</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse">
          <WarehouseStock data={warehouseStock} />
        </TabsContent>

        <TabsContent value="retailer">
          <RetailerStock data={retailerStock} />
        </TabsContent>

        <TabsContent value="ledger">
          <LedgerView
            initialEntries={ledgerData.entries}
            initialTotal={ledgerData.total}
            products={products}
            retailers={retailers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
