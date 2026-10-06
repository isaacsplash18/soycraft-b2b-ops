import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Parse header
    const header = parseCSVRow(lines[0]).map((h) => h.trim().toLowerCase());

    // Required columns
    const skuIdx = header.findIndex(
      (h) =>
        h === "sku" ||
        h === "sku code" ||
        h === "skucode" ||
        h === "sku_code"
    );
    const nameIdx = header.findIndex(
      (h) =>
        h === "name" ||
        h === "product name" ||
        h === "productname" ||
        h === "product_name"
    );
    const msrpIdx = header.findIndex(
      (h) => h === "msrp" || h === "price" || h === "retail price"
    );

    if (skuIdx === -1 || nameIdx === -1 || msrpIdx === -1) {
      return NextResponse.json(
        {
          error: `Missing required columns. Need: SKU (or "SKU Code"), Name (or "Product Name"), MSRP (or "Price"). Found headers: ${header.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Optional columns
    const categoryIdx = header.findIndex(
      (h) => h === "category" || h === "type"
    );
    const descriptionIdx = header.findIndex(
      (h) => h === "description" || h === "desc"
    );
    const activeIdx = header.findIndex(
      (h) =>
        h === "active" ||
        h === "is_active" ||
        h === "isactive" ||
        h === "status"
    );
    const weightIdx = header.findIndex(
      (h) => h === "weight" || h === "weight_kg" || h === "weight (kg)"
    );
    const barcodeIdx = header.findIndex(
      (h) => h === "barcode" || h === "ean" || h === "upc"
    );
    const imageIdx = header.findIndex(
      (h) =>
        h === "image" ||
        h === "image_url" ||
        h === "image url" ||
        h === "imageurl"
    );

    // Collect all SKUs from CSV to batch-check existing ones
    const skusInCSV: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i]);
      const sku = cols[skuIdx]?.trim();
      if (sku) skusInCSV.push(sku);
    }

    const existingProducts = await prisma.product.findMany({
      where: { skuCode: { in: skusInCSV } },
      select: { skuCode: true },
    });
    const existingSKUs = new Set(existingProducts.map((p) => p.skuCode));

    // Parse rows
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i]);
      const sku = cols[skuIdx]?.trim();
      const name = cols[nameIdx]?.trim();
      const msrpStr = cols[msrpIdx]?.trim();

      if (!sku || !name) {
        results.errors.push(`Row ${i + 1}: Missing SKU or Name`);
        results.skipped++;
        continue;
      }

      const msrp = parseFloat(msrpStr?.replace(/[^0-9.]/g, "") || "0");
      if (isNaN(msrp) || msrp < 0) {
        results.errors.push(`Row ${i + 1}: Invalid MSRP "${msrpStr}"`);
        results.skipped++;
        continue;
      }

      // Skip existing SKUs
      if (existingSKUs.has(sku)) {
        results.errors.push(`Row ${i + 1} (${sku}): SKU already exists — skipped`);
        results.skipped++;
        continue;
      }

      const category =
        categoryIdx >= 0 ? cols[categoryIdx]?.trim() || null : null;
      const description =
        descriptionIdx >= 0 ? cols[descriptionIdx]?.trim() || null : null;
      const weightKg =
        weightIdx >= 0
          ? parseFloat(cols[weightIdx]?.trim() || "") || null
          : null;
      const barcode =
        barcodeIdx >= 0 ? cols[barcodeIdx]?.trim() || null : null;
      const imageUrl =
        imageIdx >= 0 ? cols[imageIdx]?.trim() || null : null;

      // Parse active column — default to true
      let isActive = true;
      if (activeIdx >= 0) {
        const raw = cols[activeIdx]?.trim().toLowerCase() ?? "";
        if (raw === "false" || raw === "no" || raw === "0" || raw === "inactive") {
          isActive = false;
        }
      }

      try {
        await prisma.product.create({
          data: {
            skuCode: sku,
            name,
            msrp,
            category,
            description,
            weightKg,
            barcode,
            imageUrl,
            isActive,
          },
        });
        results.created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.errors.push(`Row ${i + 1} (${sku}): ${msg}`);
        results.skipped++;
      }
    }

    revalidatePath("/products");
    return NextResponse.json(results);
  } catch (err) {
    console.error("CSV import error:", err);
    return NextResponse.json(
      { error: "Failed to process CSV file" },
      { status: 500 }
    );
  }
}

// Simple CSV parser that handles quoted fields
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
