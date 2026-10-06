import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

// Column header that sorts via URL params (?sort=field&dir=asc|desc), so
// sorts survive refresh and are shareable. Clicking an active column flips
// the direction; clicking a new column starts descending (most-recent-first
// is the common want for dates and totals).
export function SortableHead({
  field,
  label,
  basePath,
  sp,
  className,
}: {
  field: string;
  label: string;
  basePath: string;
  /** Current searchParams as a flat string record (page passes these through). */
  sp: Record<string, string | undefined>;
  className?: string;
}) {
  const active = sp.sort === field;
  const dir: SortDir = active && sp.dir === "asc" ? "asc" : "desc";
  const nextDir: SortDir = active ? (dir === "desc" ? "asc" : "desc") : "desc";

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "sort" && k !== "dir") params.set(k, v);
  }
  params.set("sort", field);
  params.set("dir", nextDir);

  const Icon = !active ? ChevronsUpDown : dir === "desc" ? ArrowDown : ArrowUp;

  return (
    <TableHead className={cn("p-0", className)}>
      <Link
        href={`${basePath}?${params.toString()}`}
        className={cn(
          "flex h-9 items-center gap-1 px-2 transition-colors hover:text-foreground",
          className?.includes("text-right") && "justify-end",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !active && "opacity-50")} />
      </Link>
    </TableHead>
  );
}

// Server-side helper: resolve ?sort=&dir= into a Prisma orderBy, restricted
// to a whitelist so arbitrary params can't reach the query layer.
export function resolveSort<F extends string>(
  sp: { sort?: string; dir?: string },
  allowed: readonly F[],
  fallback: { field: F; dir: SortDir },
): { field: F; dir: SortDir } {
  const field = allowed.includes(sp.sort as F) ? (sp.sort as F) : fallback.field;
  const dir: SortDir = sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : fallback.dir;
  return { field, dir };
}
