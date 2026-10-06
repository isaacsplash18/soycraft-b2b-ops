"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import type { LedgerEntry } from "@/app/(admin)/inventory/actions";
import { getLedgerEntries } from "@/app/(admin)/inventory/actions";
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
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LedgerViewProps {
  initialEntries: LedgerEntry[];
  initialTotal: number;
  products: { id: string; name: string; skuCode: string }[];
  retailers: { id: string; name: string }[];
}

type MovementType =
  | "RESTOCK"
  | "DISPATCH_TO_RETAILER"
  | "RECEIVE_AT_RETAILER"
  | "SELL_THROUGH"
  | "RETURN_TO_SOYCRAFT"
  | "DAMAGE_WRITEOFF"
  | "ADJUSTMENT";

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: "RESTOCK", label: "Restock" },
  { value: "DISPATCH_TO_RETAILER", label: "Dispatch to Retailer" },
  { value: "RECEIVE_AT_RETAILER", label: "Receive at Retailer" },
  { value: "SELL_THROUGH", label: "Sell Through" },
  { value: "RETURN_TO_SOYCRAFT", label: "Return to Soycraft" },
  { value: "DAMAGE_WRITEOFF", label: "Damage / Write-off" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

const MOVEMENT_BADGE_COLORS: Record<string, string> = {
  RESTOCK: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  DISPATCH_TO_RETAILER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  RECEIVE_AT_RETAILER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SELL_THROUGH: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  RETURN_TO_SOYCRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  DAMAGE_WRITEOFF: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ADJUSTMENT: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LedgerView({
  initialEntries,
  initialTotal,
  products,
  retailers,
}: LedgerViewProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 25;

  // Filters
  const [productId, setProductId] = useState("");
  const [retailerId, setRetailerId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchEntries = useCallback(
    async (
      newPage: number,
      append: boolean,
      overrides?: {
        productId?: string;
        retailerId?: string;
        movementType?: string;
        dateFrom?: string;
        dateTo?: string;
      }
    ) => {
      setLoading(true);
      try {
        const filters = {
          productId: (overrides?.productId ?? productId) || undefined,
          retailerId: (overrides?.retailerId ?? retailerId) || undefined,
          movementType: (overrides?.movementType ?? movementType) || undefined,
          dateFrom: (overrides?.dateFrom ?? dateFrom) || undefined,
          dateTo: (overrides?.dateTo ?? dateTo) || undefined,
          page: newPage,
          pageSize: PAGE_SIZE,
        };

        const result = await getLedgerEntries(filters);

        if (append) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }
        setTotal(result.total);
        setPage(newPage);
      } catch (err) {
        console.error("Failed to fetch ledger entries:", err);
      } finally {
        setLoading(false);
      }
    },
    [productId, retailerId, movementType, dateFrom, dateTo]
  );

  function handleFilterChange(
    field: string,
    value: string
  ) {
    const overrides: Record<string, string> = {
      productId,
      retailerId,
      movementType,
      dateFrom,
      dateTo,
    };
    overrides[field] = value;

    switch (field) {
      case "productId":
        setProductId(value);
        break;
      case "retailerId":
        setRetailerId(value);
        break;
      case "movementType":
        setMovementType(value);
        break;
      case "dateFrom":
        setDateFrom(value);
        break;
      case "dateTo":
        setDateTo(value);
        break;
    }

    fetchEntries(1, false, overrides);
  }

  function handleLoadMore() {
    fetchEntries(page + 1, true);
  }

  const hasMore = entries.length < total;

  return (
    <div className="space-y-4 pt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <select
            value={productId}
            onChange={(e) => handleFilterChange("productId", e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.skuCode} - {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <select
            value={retailerId}
            onChange={(e) => handleFilterChange("retailerId", e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All Locations</option>
            <option value="WAREHOUSE">Warehouse</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Movement Type</Label>
          <select
            value={movementType}
            onChange={(e) =>
              handleFilterChange("movementType", e.target.value)
            }
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All Types</option>
            {MOVEMENT_TYPES.map((mt) => (
              <option key={mt.value} value={mt.value}>
                {mt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) =>
              handleFilterChange("dateFrom", e.target.value)
            }
            className="h-8 w-36"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            className="h-8 w-36"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Movement Type</TableHead>
              <TableHead className="text-right">Qty Change</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No ledger entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(entry.createdAt), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">{entry.skuCode}</TableCell>
                  <TableCell>{entry.productName}</TableCell>
                  <TableCell>
                    {entry.retailerName ?? "Warehouse"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        MOVEMENT_BADGE_COLORS[entry.movementType] ??
                        "bg-gray-100 text-gray-700"
                      }
                    >
                      {entry.movementType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span
                      className={
                        entry.quantityChange > 0
                          ? "text-emerald-600"
                          : entry.quantityChange < 0
                          ? "text-red-600"
                          : ""
                      }
                    >
                      {entry.quantityChange > 0
                        ? `+${entry.quantityChange}`
                        : entry.quantityChange}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.referenceType ?? "\u2014"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {entry.notes ?? "\u2014"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More ({entries.length} of {total})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
