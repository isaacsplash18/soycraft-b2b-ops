/**
 * Generates a CSV string from headers and rows.
 * Properly escapes values containing commas, quotes, or newlines.
 */
export function generateCSV(headers: string[], rows: string[][]): string {
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
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));

  return [headerLine, ...dataLines].join("\n");
}
