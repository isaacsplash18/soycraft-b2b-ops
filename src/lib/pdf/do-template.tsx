import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import "@/lib/pdf/setup";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Logo (read once at module level, convert to base64 data URI)
// ---------------------------------------------------------------------------

const logoPath = path.join(process.cwd(), "public/soycraft-wordmark.png");
const logoBase64 = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoLineItemData {
  skuCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DoPdfData {
  doNumber: string;
  orderDate: string;
  deliveryDate: string | null;
  retailerName: string;
  retailerAddress: string | null;
  outletName: string | null;
  outletAddress: string | null;
  sourceReference: string | null;
  notes: string | null;
  lineItems: DoLineItemData[];
  subtotal: number;
  companyName: string;
  companyAddress: string;
  companyUen: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CORAL = "#E8836B";
const BLUSH = "#FFF8F6";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: "#333333",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: CORAL,
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 8,
    color: "#666666",
    lineHeight: 1.5,
  },
  // Title
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: CORAL,
    marginBottom: 20,
    textAlign: "center",
  },
  // Info block
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 7,
    color: "#999999",
    textTransform: "uppercase" as const,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    marginBottom: 6,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: CORAL,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EEEEEE",
  },
  tableRowAlt: {
    backgroundColor: BLUSH,
  },
  // Table columns
  colNo: { width: "5%" },
  colSku: { width: "23%" },
  colProduct: { width: "28%" },
  colQty: { width: "10%", textAlign: "right" as const },
  colPrice: { width: "17%", textAlign: "right" as const },
  colTotal: { width: "17%", textAlign: "right" as const },
  // Subtotal
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingRight: 8,
  },
  subtotalLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginRight: 16,
  },
  subtotalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: CORAL,
  },
  // Notes
  notesSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  // Signature
  signatureLine: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    width: "40%",
    borderTopWidth: 1,
    borderTopColor: "#CCCCCC",
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#999999",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#DDDDDD",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: "#AAAAAA",
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSGD(value: number): string {
  return value.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DoDocument({ data }: { data: DoPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {logoBase64 ? (
              <Image src={logoBase64} style={{ width: 180, height: 40, marginBottom: 6 }} />
            ) : (
              <Text style={styles.companyName}>{data.companyName}</Text>
            )}
            {!logoBase64 && data.companyAddress ? (
              data.companyAddress.split("\n").map((line, i) => (
                <Text key={`addr-${i}`} style={styles.companyDetails}>{line}</Text>
              ))
            ) : logoBase64 ? (
              <>
                <Text style={styles.companyDetails}>{data.companyName}</Text>
                {data.companyAddress ? (
                  data.companyAddress.split("\n").map((line, i) => (
                    <Text key={`addr-${i}`} style={styles.companyDetails}>{line}</Text>
                  ))
                ) : null}
              </>
            ) : null}
            {data.companyUen ? (
              <Text style={styles.companyDetails}>UEN: {data.companyUen}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" as const }}>
            <Text style={styles.companyDetails}>www.soycraft.co</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>DELIVERY ORDER</Text>

        {/* Info Block */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>DO Number</Text>
            <Text style={styles.infoValue}>{data.doNumber}</Text>
            {data.sourceReference && (
              <>
                <Text style={styles.infoLabel}>PO Reference</Text>
                <Text style={styles.infoValue}>{data.sourceReference}</Text>
              </>
            )}
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{data.orderDate}</Text>
            {data.deliveryDate && (
              <>
                <Text style={styles.infoLabel}>Delivery Date</Text>
                <Text style={styles.infoValue}>{data.deliveryDate}</Text>
              </>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Deliver To</Text>
            <Text style={styles.infoValue}>
              {data.retailerName}
              {data.outletName ? ` — ${data.outletName}` : ""}
            </Text>
            {(data.outletAddress || data.retailerAddress) && (
              <>
                {(data.outletAddress || data.retailerAddress || "").split("\n").map((line, i) => (
                  <Text key={i} style={{ ...styles.companyDetails, marginTop: i === 0 ? 2 : 0 }}>
                    {line}
                  </Text>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.tableHeaderText, ...styles.colNo }}>No.</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colSku }}>SKU</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colProduct }}>
            Product
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colQty }}>Qty</Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colPrice }}>
            Unit Price (SGD)
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colTotal }}>
            Total (SGD)
          </Text>
        </View>

        {/* Table Rows */}
        {data.lineItems.map((item, idx) => (
          <View
            key={idx}
            style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.colNo}>{idx + 1}</Text>
            <Text style={styles.colSku}>{item.skuCode}</Text>
            <Text style={styles.colProduct}>{item.productName}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatSGD(item.unitPrice)}</Text>
            <Text style={styles.colTotal}>{formatSGD(item.lineTotal)}</Text>
          </View>
        ))}

        {/* Subtotal */}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal:</Text>
          <Text style={styles.subtotalValue}>SGD {formatSGD(data.subtotal)}</Text>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureLine}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>
              Received by: ________________
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>
              Date: ________________
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Thank you for your business!
          </Text>
          <Text style={styles.footerText}>www.soycraft.co</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
