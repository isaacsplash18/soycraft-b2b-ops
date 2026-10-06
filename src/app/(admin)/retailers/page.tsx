import Link from "next/link";
import { getRetailers } from "./actions";

type Retailer = Awaited<ReturnType<typeof getRetailers>>[number];

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

export default async function RetailersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { search, type } = await searchParams;

  const searchStr = typeof search === "string" ? search : undefined;
  const typeStr = typeof type === "string" ? type : undefined;

  const retailers = await getRetailers(searchStr, typeStr);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Retailers</h1>
        <Button asChild>
          <Link href="/retailers/new">
            <Plus className="size-4" />
            Add Retailer
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3" method="GET">
        <FilterSearch
          name="search"
          placeholder="Search by name, email, or contact..."
          defaultValue={searchStr ?? ""}
          className="w-full max-w-xs"
        />
        <FilterSelect name="type" defaultValue={typeStr ?? ""}>
          <option value="">All Types</option>
          <option value="BUYOUT">Buy-out</option>
          <option value="CONSIGNMENT">Consignment</option>
        </FilterSelect>
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </noscript>
        {(searchStr || typeStr) && (
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <Link href="/retailers">
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
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {retailers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No retailers found.
                </TableCell>
              </TableRow>
            ) : (
              retailers.map((retailer: Retailer) => (
                <TableRow key={retailer.id}>
                  <TableCell>
                    <Link
                      href={`/retailers/${retailer.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {retailer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {retailer.contactPerson ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {retailer.email}
                  </TableCell>
                  <TableCell>
                    {retailer.type === "BUYOUT" ? (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Buy-out
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Consignment
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {retailer.paymentTerms ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    {retailer.isActive ? (
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
