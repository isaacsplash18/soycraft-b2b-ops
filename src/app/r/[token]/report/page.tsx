import { getRetailerByToken, getRetailerInventory } from "../actions";
import { AlertTriangle } from "lucide-react";
import { SellThroughForm } from "./sell-through-form";

export default async function ReportSellThroughPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const retailer = await getRetailerByToken(token);

  if (!retailer || !retailer.isActive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900">
          Invalid or expired link
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This retailer portal link is no longer valid.
        </p>
      </div>
    );
  }

  const inventory = await getRetailerInventory(retailer.id);

  if (inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          No Consignment Stock
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There is currently no consignment stock to report sell-through for.
        </p>
      </div>
    );
  }

  return (
    <SellThroughForm
      token={token}
      retailerId={retailer.id}
      retailerName={retailer.name}
      inventory={inventory}
    />
  );
}
