import { getActiveRetailers } from "../actions";
import { DOForm } from "@/components/delivery-orders/do-form";

export const dynamic = "force-dynamic";

export default async function NewDeliveryOrderPage() {
  const retailers = await getActiveRetailers();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create Delivery Order</h1>
      <DOForm retailers={retailers} />
    </div>
  );
}
