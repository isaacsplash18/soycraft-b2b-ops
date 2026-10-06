import Link from "next/link";
import {
  getRetailerByToken,
  getRetailerInventory,
  getRetailerReportHistory,
} from "./actions";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { AlertTriangle, ClipboardList, Package } from "lucide-react";

const formatSGD = (value: number | string) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(Number(value));

const statusBadge: Record<string, { className: string; label: string }> = {
  DRAFT: {
    className: "bg-gray-100 text-gray-600",
    label: "Draft",
  },
  SUBMITTED: {
    className: "bg-pink-100 text-pink-700",
    label: "Submitted",
  },
  APPROVED: {
    className: "bg-emerald-100 text-emerald-700",
    label: "Approved",
  },
  INVOICED: {
    className: "bg-blue-100 text-blue-700",
    label: "Invoiced",
  },
};

export default async function RetailerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const retailer = await getRetailerByToken(token);

  if (!retailer || !retailer.isActive) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900">
          Invalid or expired link
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This retailer portal link is no longer valid. Please contact Soycraft
          for a new link.
        </p>
      </div>
    );
  }

  const [inventory, reports] = await Promise.all([
    getRetailerInventory(retailer.id),
    getRetailerReportHistory(retailer.id),
  ]);

  return (
    <div className="space-y-8">
      {/* Retailer Name */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{retailer.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome to your Soycraft retailer portal
        </p>
      </div>

      {/* Current Inventory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-muted-foreground" />
            Current Consignment Stock
          </CardTitle>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            asChild
          >
            <Link href={`/r/${token}/report`}>
              <ClipboardList className="size-3.5" />
              Report Sell-Through
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No consignment stock on hand.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty on Hand</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        {item.skuCode}
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        {item.currentStock}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSGD(item.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Reports */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              Report History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const badge =
                      statusBadge[report.status] ?? statusBadge.DRAFT;
                    const total = report.lineItems.reduce(
                      (sum, li) => sum + Number(li.lineTotal),
                      0
                    );
                    return (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {format(
                            new Date(report.reportingMonth),
                            "MMM yyyy"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={badge.className}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {report.submittedAt
                            ? format(
                                new Date(report.submittedAt),
                                "dd MMM yyyy"
                              )
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSGD(total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
