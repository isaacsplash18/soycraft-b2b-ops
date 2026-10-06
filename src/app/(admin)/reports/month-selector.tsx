"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter();

  return (
    <input
      type="month"
      value={currentMonth}
      onChange={(e) => {
        if (e.target.value) {
          router.push(`/reports?month=${e.target.value}`);
        }
      }}
      className="rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}
