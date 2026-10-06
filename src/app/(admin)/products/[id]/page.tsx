import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, updateProduct, toggleProductActive } from "../actions";
import { ProductForm } from "@/components/products/product-form";
import { Badge } from "@/components/ui/badge";

type ProductWithPricing = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
type RetailerPricingRow = ProductWithPricing["retailerPricing"][number];
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleActiveButton } from "./toggle-active-button";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  // Bind id to the update action so the form only sends ProductInput
  const boundUpdate = updateProduct.bind(null, id);

  // Derive margin for each retailer pricing row
  const pricingRows = product.retailerPricing.map((rp: RetailerPricingRow) => {
    const unitPrice = Number(rp.unitPrice);
    const msrp = Number(product.msrp);
    const margin = msrp > 0 ? ((msrp - unitPrice) / msrp) * 100 : 0;
    return {
      id: rp.id,
      retailerName: rp.retailer.name,
      unitPrice,
      margin,
      effectiveFrom: rp.effectiveFrom,
    };
  });

  // Map Prisma product to form-friendly shape
  const formProduct = {
    id: product.id,
    skuCode: product.skuCode,
    name: product.name,
    category: product.category ?? undefined,
    msrp: Number(product.msrp),
    weightKg: product.weightKg ? Number(product.weightKg) : undefined,
    barcode: product.barcode ?? undefined,
    shopifyVariantId: product.shopifyVariantId ?? undefined,
    imageUrl: product.imageUrl ?? undefined,
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Edit Product</h1>
          {product.isActive ? (
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
          productId={id}
          isActive={product.isActive}
          toggleAction={toggleProductActive}
        />
      </div>

      {/* Form */}
      <ProductForm product={formProduct} action={boundUpdate} />

      {/* Retailer Pricing */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Retailer Pricing</h2>
        {pricingRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No retailers have pricing set for this product.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Retailer</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                  <TableHead>Effective From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingRows.map((row: { id: string; retailerName: string; unitPrice: number; margin: number; effectiveFrom: Date }) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.retailerName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatSGD(row.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.margin.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.effectiveFrom).toLocaleDateString("en-SG")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
