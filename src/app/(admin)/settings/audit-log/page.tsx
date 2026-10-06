import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogFilters } from "./audit-log-filters";
import { AuditLogExpandRow } from "./audit-log-expand-row";

const ITEMS_PER_PAGE = 20;

const ENTITY_TYPES = [
  "Product",
  "Retailer",
  "Outlet",
  "DeliveryOrder",
  "Invoice",
  "SellThroughReport",
  "InventoryLedger",
  "RetailerPricing",
  "Settings",
];

async function getAuditLogs(filters: {
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
}) {
  const where: Record<string, unknown> = {};

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      (where.createdAt as Record<string, Date>).gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      (where.createdAt as Record<string, Date>).lte = new Date(
        filters.dateTo + "T23:59:59.999Z"
      );
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) };
}

async function getUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [{ logs, total, totalPages }, users] = await Promise.all([
    getAuditLogs({
      entityType: params.entityType,
      userId: params.userId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
    }),
    getUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
      </div>

      <AuditLogFilters
        entityTypes={ENTITY_TYPES}
        users={users}
        currentFilters={{
          entityType: params.entityType ?? "",
          userId: params.userId ?? "",
          dateFrom: params.dateFrom ?? "",
          dateTo: params.dateTo ?? "",
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total} log entr{total === 1 ? "y" : "ies"} found
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit log entries match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <AuditLogExpandRow
                      key={log.id}
                      timestamp={format(
                        new Date(log.createdAt),
                        "dd MMM yyyy HH:mm:ss"
                      )}
                      userName={log.user.name}
                      action={log.action}
                      entityType={log.entityType}
                      entityId={log.entityId}
                      before={log.before as Record<string, unknown> | null}
                      after={log.after as Record<string, unknown> | null}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <PaginationLink
                    params={params}
                    page={page - 1}
                    label="Previous"
                  />
                )}
                {page < totalPages && (
                  <PaginationLink
                    params={params}
                    page={page + 1}
                    label="Next"
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaginationLink({
  params,
  page,
  label,
}: {
  params: Record<string, string | undefined>;
  page: number;
  label: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.entityType) searchParams.set("entityType", params.entityType);
  if (params.userId) searchParams.set("userId", params.userId);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  searchParams.set("page", String(page));

  return (
    <a
      href={`/settings/audit-log?${searchParams.toString()}`}
      className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
    >
      {label}
    </a>
  );
}
