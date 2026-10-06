"use client";

import { useState } from "react";
import type { RetailerStockItem } from "@/app/(admin)/inventory/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Store, MapPin } from "lucide-react";

interface RetailerStockProps {
  data: RetailerStockItem[];
}

type OutletGroup = {
  outletName: string | null;
  items: RetailerStockItem[];
};

type RetailerGroup = {
  retailerName: string;
  outlets: Record<string, OutletGroup>;
};

export function RetailerStock({ data }: RetailerStockProps) {
  // Group by retailer, then by outlet
  const grouped = data.reduce<Record<string, RetailerGroup>>((acc, item) => {
    if (!acc[item.retailerId]) {
      acc[item.retailerId] = {
        retailerName: item.retailerName,
        outlets: {},
      };
    }
    const outletKey = item.outletId ?? "__no_outlet__";
    if (!acc[item.retailerId].outlets[outletKey]) {
      acc[item.retailerId].outlets[outletKey] = {
        outletName: item.outletName,
        items: [],
      };
    }
    acc[item.retailerId].outlets[outletKey].items.push(item);
    return acc;
  }, {});

  const retailerIds = Object.keys(grouped);

  // All sections expanded by default (retailers + outlet sub-sections)
  const allKeys = retailerIds.flatMap((rid) => {
    const outletKeys = Object.keys(grouped[rid].outlets).map(
      (ok) => `${rid}::${ok}`
    );
    return [rid, ...outletKeys];
  });
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(allKeys)
  );

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (retailerIds.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center pt-4 text-muted-foreground">
        No retailer stock data available.
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {retailerIds.map((retailerId) => {
        const group = grouped[retailerId];
        const isExpanded = expanded.has(retailerId);
        const outletKeys = Object.keys(group.outlets);
        const hasMultipleOutlets = outletKeys.length > 1 || (outletKeys.length === 1 && outletKeys[0] !== "__no_outlet__");
        const totalProducts = outletKeys.reduce(
          (sum, k) => sum + group.outlets[k].items.length,
          0
        );

        return (
          <div key={retailerId} className="rounded-lg border">
            {/* Retailer header */}
            <button
              type="button"
              onClick={() => toggleExpanded(retailerId)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
              <Store className="size-4 text-muted-foreground" />
              <span className="font-medium">{group.retailerName}</span>
              <span className="text-sm text-muted-foreground">
                ({totalProducts} product{totalProducts !== 1 ? "s" : ""}
                {hasMultipleOutlets ? `, ${outletKeys.length} outlets` : ""})
              </span>
            </button>

            {/* Collapsible content */}
            {isExpanded && (
              <div>
                {hasMultipleOutlets ? (
                  // Render outlet sub-sections
                  outletKeys.map((outletKey) => {
                    const outletGroup = group.outlets[outletKey];
                    const subKey = `${retailerId}::${outletKey}`;
                    const isOutletExpanded = expanded.has(subKey);

                    return (
                      <div key={outletKey} className="border-t">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(subKey)}
                          className="flex w-full items-center gap-2 px-8 py-2 text-left hover:bg-muted/30 transition-colors"
                        >
                          {isOutletExpanded ? (
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          )}
                          <MapPin className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {outletGroup.outletName ?? "No outlet assigned"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({outletGroup.items.length} product{outletGroup.items.length !== 1 ? "s" : ""})
                          </span>
                        </button>
                        {isOutletExpanded && (
                          <StockTable items={outletGroup.items} />
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Single outlet or no outlets -- render table directly
                  <StockTable items={outletKeys.length > 0 ? group.outlets[outletKeys[0]].items : []} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StockTable({ items }: { items: RetailerStockItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">
            Quantity at Location
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={`${item.retailerId}-${item.outletId ?? "none"}-${item.productId}`}>
            <TableCell className="font-medium">
              {item.skuCode}
            </TableCell>
            <TableCell>{item.productName}</TableCell>
            <TableCell className="text-right">
              {item.quantity}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
