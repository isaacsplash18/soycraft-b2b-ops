"use client";

import type { WarehouseStockItem } from "@/app/(admin)/inventory/actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

interface WarehouseStockProps {
  data: WarehouseStockItem[];
}

export function WarehouseStock({ data }: WarehouseStockProps) {
  return (
    <div className="space-y-4 pt-4">
      {/* Summary card */}
      <Card size="sm">
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {data.length} products
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  No stock data available.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium">{item.skuCode}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell className="text-right">
                    {item.currentStock}
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
