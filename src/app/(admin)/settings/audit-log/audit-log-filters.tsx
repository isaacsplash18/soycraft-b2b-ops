"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

interface AuditLogFiltersProps {
  entityTypes: string[];
  users: { id: string; name: string }[];
  currentFilters: {
    entityType: string;
    userId: string;
    dateFrom: string;
    dateTo: string;
  };
}

export function AuditLogFilters({
  entityTypes,
  users,
  currentFilters,
}: AuditLogFiltersProps) {
  const router = useRouter();
  const [entityType, setEntityType] = useState(currentFilters.entityType);
  const [userId, setUserId] = useState(currentFilters.userId);
  const [dateFrom, setDateFrom] = useState(currentFilters.dateFrom);
  const [dateTo, setDateTo] = useState(currentFilters.dateTo);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    if (userId) params.set("userId", userId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/settings/audit-log?${params.toString()}`);
  };

  const clearFilters = () => {
    setEntityType("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
    router.push("/settings/audit-log");
  };

  const hasFilters = entityType || userId || dateFrom || dateTo;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="entityType" className="text-xs">
            Entity Type
          </Label>
          <select
            id="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="userId" className="text-xs">
            User
          </Label>
          <select
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateFrom" className="text-xs">
            From Date
          </Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dateTo" className="text-xs">
            To Date
          </Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={applyFilters}>
          <Search className="mr-1.5 h-3.5 w-3.5" />
          Filter
        </Button>
        {hasFilters && (
          <Button size="sm" variant="outline" onClick={clearFilters}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
