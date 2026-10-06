export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRetailer,
  updateRetailer,
  toggleRetailerActive,
  getRetailerPricing,
  getRetailerInventory,
  createOutlet,
  updateOutlet,
  toggleOutletActive,
} from "../actions";
import { RetailerForm } from "@/components/retailers/retailer-form";
import { PricingMatrix } from "@/components/retailers/pricing-matrix";
import { OutletList } from "@/components/retailers/outlet-list";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ToggleActiveButton } from "./toggle-active-button";

export default async function RetailerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Pricing and inventory only need the id, so they load alongside the
  // retailer rather than after it.
  const [retailer, pricingData, inventory] = await Promise.all([
    getRetailer(id),
    getRetailerPricing(id),
    getRetailerInventory(id),
  ]);

  if (!retailer) notFound();

  // Bind id to the update action so the form only sends RetailerInput
  const boundUpdate = updateRetailer.bind(null, id);

  // Map Prisma retailer to form-friendly shape
  const formRetailer = {
    id: retailer.id,
    name: retailer.name,
    code: retailer.code,
    contactPerson: retailer.contactPerson ?? undefined,
    email: retailer.email,
    phone: retailer.phone ?? undefined,
    address: retailer.address ?? undefined,
    type: retailer.type as "BUYOUT" | "CONSIGNMENT",
    paymentTerms: retailer.paymentTerms ?? undefined,
    notes: retailer.notes ?? undefined,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/retailers" className="hover:text-foreground">
          Retailers
        </Link>
        <span>/</span>
        <span className="text-foreground">{retailer.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{retailer.name}</h1>
          <code className="rounded bg-muted px-2 py-0.5 text-sm font-mono text-muted-foreground">
            {retailer.code}
          </code>
          {retailer.type === "BUYOUT" ? (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Buy-out
            </Badge>
          ) : (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Consignment
            </Badge>
          )}
          {retailer.isActive ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Active
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Inactive
            </Badge>
          )}
        </div>
        <ToggleActiveButton
          retailerId={id}
          isActive={retailer.isActive}
          toggleAction={toggleRetailerActive}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList variant="line">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="outlets">Outlets</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="pt-6">
          <RetailerForm retailer={formRetailer} action={boundUpdate} />
        </TabsContent>

        {/* Outlets Tab */}
        <TabsContent value="outlets" className="pt-6">
          <OutletList
            retailerId={id}
            outlets={retailer.outlets.map((o) => ({
              id: o.id,
              retailerId: o.retailerId,
              name: o.name,
              code: o.code,
              address: o.address,
              contactPerson: o.contactPerson,
              phone: o.phone,
              isActive: o.isActive,
            }))}
            createAction={createOutlet}
            updateAction={updateOutlet}
            toggleAction={toggleOutletActive}
          />
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="pt-6">
          <PricingMatrix retailerId={id} initialData={pricingData} />
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="pt-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Current Stock</h2>
            {inventory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No inventory at this retailer.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Code</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((item: { productId: string; skuCode: string; productName: string; quantity: number; byOutlet: { outletId: string; outletName: string; outletCode: string; quantity: number }[] }) => (
                      <TableRow key={item.productId}>
                        <TableCell className="font-medium">
                          {item.skuCode}
                        </TableCell>
                        <TableCell>
                          <div>{item.productName}</div>
                          {item.byOutlet.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {item.byOutlet.map((o) => (
                                <span
                                  key={o.outletId}
                                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                                >
                                  {o.outletCode}: {o.quantity}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="pt-6">
          <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
            <p className="text-sm text-muted-foreground">
              Delivery orders for this retailer will appear here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
