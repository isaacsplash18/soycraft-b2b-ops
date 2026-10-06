"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AuditLogExpandRowProps {
  timestamp: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export function AuditLogExpandRow({
  timestamp,
  userName,
  action,
  entityType,
  entityId,
  before,
  after,
}: AuditLogExpandRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = before !== null || after !== null;

  // Compute diff between before/after
  const diffEntries: { key: string; old: string; new: string }[] = [];
  if (before && after) {
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
      const oldVal = JSON.stringify(before[key] ?? null);
      const newVal = JSON.stringify(after[key] ?? null);
      if (oldVal !== newVal) {
        diffEntries.push({
          key,
          old: before[key] !== undefined ? String(before[key]) : "-",
          new: after[key] !== undefined ? String(after[key]) : "-",
        });
      }
    }
  }

  return (
    <>
      <TableRow
        className={hasChanges ? "cursor-pointer hover:bg-muted/50" : ""}
        onClick={() => hasChanges && setExpanded(!expanded)}
      >
        <TableCell className="text-xs whitespace-nowrap">{timestamp}</TableCell>
        <TableCell className="text-sm">{userName}</TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              action === "CREATE"
                ? "bg-emerald-100 text-emerald-700"
                : action === "UPDATE"
                  ? "bg-blue-100 text-blue-700"
                  : action === "DELETE"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
            }`}
          >
            {action}
          </span>
        </TableCell>
        <TableCell className="text-sm">{entityType}</TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[120px]">
          {entityId}
        </TableCell>
        <TableCell>
          {hasChanges ? (
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {diffEntries.length > 0
                ? `${diffEntries.length} change${diffEntries.length !== 1 ? "s" : ""}`
                : "View data"}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
      </TableRow>

      {expanded && hasChanges && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            {diffEntries.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Changes:
                </p>
                <div className="grid gap-2">
                  {diffEntries.map((d) => (
                    <div
                      key={d.key}
                      className="grid grid-cols-3 gap-2 text-xs"
                    >
                      <span className="font-medium">{d.key}</span>
                      <span className="text-red-600 line-through">{d.old}</span>
                      <span className="text-emerald-600">{d.new}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {before && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Before:
                    </p>
                    <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-48">
                      {JSON.stringify(before, null, 2)}
                    </pre>
                  </div>
                )}
                {after && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      After:
                    </p>
                    <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-48">
                      {JSON.stringify(after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
