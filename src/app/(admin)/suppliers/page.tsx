import Link from "next/link";
import { getSuppliers } from "./actions";
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
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

type Supplier = Awaited<ReturnType<typeof getSuppliers>>[number];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { search } = await searchParams;
  const searchStr = typeof search === "string" ? search : undefined;
  const suppliers = await getSuppliers(searchStr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="size-4" />
            Add Supplier
          </Link>
        </Button>
      </div>

      <form className="flex items-center gap-3" method="GET">
        <Input
          name="search"
          placeholder="Search by name, code, or contact..."
          defaultValue={searchStr ?? ""}
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {searchStr && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/suppliers">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No suppliers found.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s: Supplier) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contactPerson ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.phone ?? "\u2014"}
                  </TableCell>
                  <TableCell>
                    {s.isActive ? (
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
