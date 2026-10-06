import { NextRequest } from "next/server";
import { getFinanceEntries } from "../../actions";

export const dynamic = "force-dynamic";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const entries = await getFinanceEntries({
    category: sp.get("category") ?? undefined,
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    search: sp.get("search") ?? undefined,
  });

  const headers = [
    "Date",
    "Category",
    "Amount",
    "Description",
    "Supplier",
    "Supplier Order",
    "Event Name",
    "Event Sub-category",
    "Other Sub-category",
    "Notes",
  ];

  const rows = entries.map((e) =>
    [
      new Date(e.entryDate).toISOString().slice(0, 10),
      e.category,
      Number(e.amount).toFixed(2),
      e.description ?? "",
      e.supplier?.name ?? "",
      e.supplierOrder?.soNumber ?? "",
      e.eventName ?? "",
      e.eventSubCategory ?? "",
      e.otherSubCategory?.name ?? "",
      e.notes ?? "",
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-entries-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
