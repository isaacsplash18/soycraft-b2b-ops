import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ExportForm } from "./export-form";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Export Data</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Full Database Export</CardTitle>
          <CardDescription>
            Download a complete Excel workbook containing all your data across
            multiple tabs. Optionally filter transaction data by date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportForm />

          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              The export includes:
            </p>
            <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Products (all SKUs with pricing)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Retailers (profiles &amp; contacts)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Pricing Matrix (retailer x SKU grid)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Warehouse Inventory
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Retailer Inventory
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Inventory Ledger (full history)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Delivery Orders (with line items)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Sell-Through Reports
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Invoices (with line items)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Receivables Aging
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
