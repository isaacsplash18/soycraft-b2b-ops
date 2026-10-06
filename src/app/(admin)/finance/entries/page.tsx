import Link from "next/link";
import { getFinanceEntries } from "../actions";
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
import {
  FilterSelect,
  FilterInput,
  FilterSearch,
} from "@/components/ui/filter-controls";
import { Plus, Download } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const formatSGD = (v: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(v));

const categoryBadge: Record<string, { className: string; label: string }> = {
  INVENTORY: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    label: "Inventory",
  },
  EVENT: {
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    label: "Event",
  },
  OTHER: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    label: "Other",
  },
};

export default async function FinanceEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : undefined;
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : undefined;
  const search = typeof sp.search === "string" ? sp.search : undefined;

  const entries = await getFinanceEntries({ category, dateFrom, dateTo, search });
  const total = entries.reduce((s, e) => s + Number(e.amount), 0);

  type Entry = (typeof entries)[number];

  const exportParams = new URLSearchParams();
  if (category) exportParams.set("category", category);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  if (search) exportParams.set("search", search);

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">
          Finance
        </Link>
        <span>/</span>
        <span className="text-foreground">Entries</span>
      </nav>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Finance Entries</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/finance/entries/export?${exportParams.toString()}`}>
              <Download className="size-3.5" />
              CSV
            </a>
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/finance/entries/new">
              <Plus className="size-4" />
              New Entry
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="GET">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Category</label>
          <FilterSelect
            name="category"
            defaultValue={category ?? "ALL"}
            className="block w-36"
          >
            <option value="ALL">All</option>
            <option value="INVENTORY">Inventory</option>
            <option value="EVENT">Event</option>
            <option value="OTHER">Other</option>
          </FilterSelect>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <FilterInput type="date" name="dateFrom" defaultValue={dateFrom ?? ""} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <FilterInput type="date" name="dateTo" defaultValue={dateTo ?? ""} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <FilterSearch name="search" defaultValue={search ?? ""} placeholder="Description…" />
        </div>
        <noscript>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </noscript>
        {(category || dateFrom || dateTo || search) && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/entries">Clear</Link>
          </Button>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e: Entry) => {
                const badge = categoryBadge[e.category];
                const reference =
                  e.supplierOrder?.soNumber ??
                  e.eventName ??
                  e.otherSubCategory?.name ??
                  e.supplier?.name ??
                  "\u2014";
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      {format(new Date(e.entryDate), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/finance/entries/${e.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {e.description ?? "(no description)"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {reference}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatSGD(Number(e.amount))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {entries.length > 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatSGD(total)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
