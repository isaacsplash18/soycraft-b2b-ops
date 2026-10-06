import Link from "next/link";
import {
  getFinanceSummary,
  getMonthlyTotals,
  getFinanceEntries,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Plus, Settings2 } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const formatSGD = (v: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(v));

const cards = [
  {
    key: "INVENTORY" as const,
    label: "Inventory",
    color: "bg-blue-500",
    text: "text-blue-600",
  },
  {
    key: "EVENT" as const,
    label: "Events",
    color: "bg-purple-500",
    text: "text-purple-600",
  },
  {
    key: "OTHER" as const,
    label: "Other",
    color: "bg-amber-500",
    text: "text-amber-600",
  },
];

export default async function FinanceDashboardPage() {
  const [summary, monthly, recent] = await Promise.all([
    getFinanceSummary(),
    getMonthlyTotals(6),
    getFinanceEntries(),
  ]);

  const recentTop = recent.slice(0, 8);
  const maxMonth = Math.max(1, ...monthly.map((m) => m.total));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Finance</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/categories">
              <Settings2 className="size-3.5" />
              Manage Categories
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/entries">All Entries</Link>
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/finance/entries/new">
              <Plus className="size-4" />
              New Entry
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.text}`}>
              {formatSGD(summary[c.key])}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {c.key === "INVENTORY"
                ? `${summary.inventoryCount} entries`
                : c.key === "EVENT"
                ? `${summary.eventCount} entries`
                : `${summary.otherCount} entries`}
            </p>
          </div>
        ))}
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{formatSGD(summary.grand)}</p>
          <p className="text-xs text-muted-foreground mt-1">All-time</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Last 6 Months</h2>
        <div className="space-y-2">
          {monthly.map((m) => {
            const inv = (m.INVENTORY / maxMonth) * 100;
            const ev = (m.EVENT / maxMonth) * 100;
            const ot = (m.OTHER / maxMonth) * 100;
            return (
              <div key={m.month} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.month}</span>
                  <span className="font-medium">{formatSGD(m.total)}</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded bg-muted">
                  <div className="bg-blue-500" style={{ width: `${inv}%` }} />
                  <div className="bg-purple-500" style={{ width: `${ev}%` }} />
                  <div className="bg-amber-500" style={{ width: `${ot}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-blue-500" /> Inventory
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-purple-500" /> Event
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-500" /> Other
          </span>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Recent Entries</h2>
          <Link href="/finance/entries" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y">
          {recentTop.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No entries yet.
            </p>
          ) : (
            recentTop.map((e) => (
              <Link
                key={e.id}
                href={`/finance/entries/${e.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {e.description ??
                      e.eventName ??
                      e.otherSubCategory?.name ??
                      e.supplierOrder?.soNumber ??
                      e.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.entryDate), "dd MMM yyyy")} · {e.category}
                  </p>
                </div>
                <span className="font-medium">{formatSGD(Number(e.amount))}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
