"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvDownloadButtonProps {
  data: Record<string, unknown>[];
  filename: string;
}

export function CsvDownloadButton({ data, filename }: CsvDownloadButtonProps) {
  const handleDownload = () => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    const escapeCell = (cell: string): string => {
      if (
        cell.includes(",") ||
        cell.includes('"') ||
        cell.includes("\n") ||
        cell.includes("\r")
      ) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };

    const headerLine = headers.map(escapeCell).join(",");
    const rows = data.map((row) =>
      headers.map((h) => escapeCell(String(row[h] ?? ""))).join(",")
    );

    const csv = [headerLine, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={data.length === 0}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      Download CSV
    </Button>
  );
}
