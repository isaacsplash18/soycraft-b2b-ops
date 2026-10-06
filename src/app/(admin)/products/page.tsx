import Link from "next/link";
import { getProducts, getCategories } from "./actions";

export const dynamic = "force-dynamic";

type Product = Awaited<ReturnType<typeof getProducts>>[number];
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterSelect, FilterSearch } from "@/components/ui/filter-controls";
import { Plus } from "lucide-react";
import { CSVImportButton } from "@/components/products/csv-import";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { search, category } = await searchParams;

  const searchStr = typeof search === "string" ? search : undefined;
  const categoryStr = typeof category === "string" ? category : undefined;

  const [products, categories] = await Promise.all([
    getProducts(searchStr, categoryStr),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex gap-2">
          <CSVImportButton />
          <Button asChild>
            <Link href="/products/new">
              <Plus className="size-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3" method="GET">
        <FilterSearch
          name="search"
          placeholder="Search by name or SKU..."
          defaultValue={searchStr ?? ""}
          className="w-full max-w-xs"
        />
        <FilterSelect name="category" defaultValue={categoryStr ?? ""}>
          <option value="">All Categories</option>
          {categories.map((cat: string) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </FilterSelect>
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </noscript>
        {(searchStr || categoryStr) && (
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link href="/products">
              Clear
            </Link>
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">MSRP</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: Product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link
                      href={`/products/${product.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {product.skuCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.category ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatSGD(Number(product.msrp))}
                  </TableCell>
                  <TableCell>
                    {product.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
