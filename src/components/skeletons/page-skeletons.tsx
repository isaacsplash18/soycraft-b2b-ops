import { Skeleton } from "@/components/ui/skeleton";

export function ListPageSkeleton({
  rows = 6,
  filters = true,
  title = "Loading",
}: {
  rows?: number;
  filters?: boolean;
  title?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      {filters && (
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-32" />
        </div>
      )}
      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3">
          <Skeleton className="h-3 w-32" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b px-4 py-4 last:border-0"
          >
            <div className="flex flex-1 items-center gap-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="hidden h-3 w-24 md:block" />
              <Skeleton className="hidden h-3 w-24 md:block" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailPageSkeleton({ title = "Loading" }: { title?: string }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-3 w-48" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-3 w-72" />
      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="rounded-lg border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b px-4 py-4 last:border-0"
            >
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormPageSkeleton({ title = "Loading" }: { title?: string }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-3 w-40" />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-5 rounded-lg border p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}
