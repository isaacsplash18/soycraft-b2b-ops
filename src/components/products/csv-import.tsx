"use client";

import { useState, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedRow = {
  skuCode: string;
  name: string;
  msrp: string;
  category: string;
  description: string;
  active: string;
  rowNumber: number;
  error?: string;
};

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// CSV helpers (client-side)
// ---------------------------------------------------------------------------

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function findColumn(headers: string[], ...aliases: string[]): number {
  return headers.findIndex((h) => aliases.includes(h));
}

function parseCSV(text: string): { rows: ParsedRow[]; headerError?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], headerError: "CSV must have a header row and at least one data row" };
  }

  const headers = parseCSVRow(lines[0]).map((h) => h.trim().toLowerCase());

  const skuIdx = findColumn(headers, "sku", "sku code", "skucode", "sku_code");
  const nameIdx = findColumn(headers, "name", "product name", "productname", "product_name");
  const msrpIdx = findColumn(headers, "msrp", "price", "retail price");

  if (skuIdx === -1 || nameIdx === -1 || msrpIdx === -1) {
    return {
      rows: [],
      headerError: `Missing required columns. Need: SKU Code, Name, MSRP. Found: ${headers.join(", ")}`,
    };
  }

  const categoryIdx = findColumn(headers, "category", "type");
  const descriptionIdx = findColumn(headers, "description", "desc");
  const activeIdx = findColumn(headers, "active", "is_active", "isactive", "status");

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const sku = cols[skuIdx]?.trim() ?? "";
    const name = cols[nameIdx]?.trim() ?? "";
    const msrp = cols[msrpIdx]?.trim() ?? "";
    const category = categoryIdx >= 0 ? cols[categoryIdx]?.trim() ?? "" : "";
    const description = descriptionIdx >= 0 ? cols[descriptionIdx]?.trim() ?? "" : "";
    const activeRaw = activeIdx >= 0 ? cols[activeIdx]?.trim().toLowerCase() ?? "" : "";
    const active = activeRaw === "" ? "true" : activeRaw;

    let error: string | undefined;
    if (!sku || !name) error = "Missing SKU or Name";
    else {
      const parsed = parseFloat(msrp.replace(/[^0-9.]/g, ""));
      if (isNaN(parsed) || parsed < 0) error = `Invalid MSRP "${msrp}"`;
    }

    rows.push({
      skuCode: sku,
      name,
      msrp,
      category,
      description,
      active,
      rowNumber: i + 1,
      error,
    });
  }

  return { rows };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const formatSGD = (value: string) => {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return value;
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(n);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CSVImportButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [csvText, setCsvText] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setParsedRows([]);
    setCsvText("");
    setParseError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  function handleClose() {
    setOpen(false);
    // Reset after animation
    setTimeout(reset, 200);
  }

  function handleFileSelect() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, headerError } = parseCSV(text);

      if (headerError) {
        setParseError(headerError);
        setStep("upload");
        return;
      }

      setCsvText(text);
      setParsedRows(rows);
      setParseError(null);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  function handleImport() {
    const formData = new FormData();
    const blob = new Blob([csvText], { type: "text/csv" });
    formData.append("file", blob, "import.csv");

    startTransition(async () => {
      try {
        const resp = await fetch("/api/products/import", {
          method: "POST",
          body: formData,
        });

        const data = await resp.json();

        if (!resp.ok) {
          toast.error(data.error || "Import failed");
          return;
        }

        setResult(data);
        setStep("result");

        if (data.created > 0 || data.updated > 0) {
          toast.success(
            `Imported: ${data.created} created, ${data.skipped} skipped`
          );
          router.refresh();
        }
      } catch {
        toast.error("Failed to upload file");
      }
    });
  }

  function downloadTemplate() {
    const csv = `SKU Code,Name,MSRP,Category,Description,Active
R7BLACK,R7 BLACK,300,Strollers,Black R7 stroller,true
R7GREY,R7 GREY,300,Strollers,Grey R7 stroller,true`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soycraft_product_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const validRows = parsedRows.filter((r) => !r.error);
  const errorRows = parsedRows.filter((r) => r.error);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Import CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
        <DialogContent
          className={
            step === "preview"
              ? "sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
              : "sm:max-w-md"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              {step === "upload" && "Import Products"}
              {step === "preview" && "Preview Import"}
              {step === "result" && "Import Complete"}
            </DialogTitle>
            <DialogDescription>
              {step === "upload" &&
                "Upload a CSV file with your products. Required columns: SKU Code, Name, MSRP. Optional: Category, Description, Active."}
              {step === "preview" &&
                `${validRows.length} product${validRows.length !== 1 ? "s" : ""} ready to import.${errorRows.length > 0 ? ` ${errorRows.length} row${errorRows.length !== 1 ? "s" : ""} with errors will be skipped.` : ""} Rows with existing SKU codes will be skipped.`}
              {step === "result" && "Here are the results of your import."}
            </DialogDescription>
          </DialogHeader>

          {/* ---- STEP: Upload ---- */}
          {step === "upload" && (
            <div className="space-y-4">
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  <AlertCircle className="size-4 mt-0.5 shrink-0" />
                  {parseError}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="size-4" />
                Download CSV Template
              </Button>

              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to select a CSV file
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ---- STEP: Preview ---- */}
          {step === "preview" && (
            <>
              <div className="flex-1 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>SKU Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">MSRP</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow
                        key={i}
                        className={row.error ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.skuCode || "\u2014"}
                        </TableCell>
                        <TableCell>{row.name || "\u2014"}</TableCell>
                        <TableCell className="text-right">
                          {row.msrp ? formatSGD(row.msrp) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.category || "\u2014"}
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground max-w-[150px] truncate"
                          title={row.description}
                        >
                          {row.description || "\u2014"}
                        </TableCell>
                        <TableCell>
                          {row.active === "false" || row.active === "no" || row.active === "0" ? (
                            <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              Inactive
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.error ? (
                            <span className="text-xs text-red-600">{row.error}</span>
                          ) : (
                            <span className="text-xs text-emerald-600">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { reset(); setStep("upload"); }}>
                  Choose Another File
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isPending || validRows.length === 0}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Import {validRows.length} Product{validRows.length !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* ---- STEP: Result ---- */}
          {step === "result" && result && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  {result.created > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="size-4" />
                      {result.created} created
                    </div>
                  )}
                  {result.skipped > 0 && (
                    <div className="flex items-center gap-1.5 text-pink-600">
                      <AlertCircle className="size-4" />
                      {result.skipped} skipped
                    </div>
                  )}
                </div>
                {result.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-0.5 border-t pt-2">
                    {result.errors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    reset();
                    setStep("upload");
                  }}
                >
                  Import More
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
