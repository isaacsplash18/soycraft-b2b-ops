import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getDeliveryOrder, getActiveRetailers } from "../../actions";
import { DOForm } from "@/components/delivery-orders/do-form";

export const dynamic = "force-dynamic";

export default async function EditDeliveryOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, retailers] = await Promise.all([
    getDeliveryOrder(id),
    getActiveRetailers(),
  ]);

  if (!order) notFound();

  // Only DRAFT and CONFIRMED can be edited
  if (order.status !== "DRAFT" && order.status !== "CONFIRMED") {
    redirect(`/delivery-orders/${id}`);
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/delivery-orders" className="hover:text-foreground">
          Delivery Orders
        </Link>
        <span>/</span>
        <Link href={`/delivery-orders/${id}`} className="hover:text-foreground">
          {order.doNumber}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit</span>
      </nav>
      <h1 className="text-2xl font-semibold">Edit {order.doNumber}</h1>
      <DOForm retailers={retailers} deliveryOrder={order} />
    </div>
  );
}
