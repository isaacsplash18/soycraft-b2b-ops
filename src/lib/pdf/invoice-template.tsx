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

export interface InvoiceLineItemData {
  skuCode: string | null;
  productName: string | null;
  description: string | null; // for ad-hoc items
  isAdHoc: boolean;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  billingMonth: string;
  sourceReference: string | null;
  status: string;
  // Retailer / Bill To
  retailerName: string;
  retailerAddress: string | null;
  retailerContact: string | null;
  retailerEmail: string | null;
  outletName: string | null;
  // Company details
  companyName: string;
  companyAddress: string;
  companyUen: string;
  companyGstReg: string;
  // Line items
  lineItems: InvoiceLineItemData[];
  // Financials
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  // Payment info
  bankDetails: string | null;
  // Paid
  paidAt: string | null;
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
  billToTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: CORAL,
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
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
  sectionHeader: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 0.5,
    borderBottomColor: "#EEEEEE",
  },
  sectionHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
  },
  // Table columns (no reference column now)
  colNo: { width: "6%" },
  colSku: { width: "22%" },
  colProduct: { width: "28%" },
  colQty: { width: "10%", textAlign: "right" as const },
  colPrice: { width: "17%", textAlign: "right" as const },
  colTotal: { width: "17%", textAlign: "right" as const },
  // Financial summary
  financialSection: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  financialBox: {
    width: 220,
  },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  financialLabel: {
    fontSize: 9,
    color: "#666666",
  },
  financialValue: {
    fontSize: 9,
    textAlign: "right" as const,
  },
  financialTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: CORAL,
    marginTop: 4,
  },
  financialTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  financialTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: CORAL,
    textAlign: "right" as const,
  },
  // Payment details
  paymentSection: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  paymentText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  // Paid stamp
  paidStamp: {
    position: "absolute",
    top: 200,
    right: 60,
    fontSize: 48,
    fontFamily: "Helvetica-Bold",
    color: "#00C85320",
    transform: "rotate(-30deg)",
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

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const productItems = data.lineItems.filter((item) => !item.isAdHoc);
  const adHocItems = data.lineItems.filter((item) => item.isAdHoc);
  const hasAdHoc = adHocItems.length > 0;

  let rowCounter = 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Paid watermark */}
        {data.status === "PAID" && (
          <Text style={styles.paidStamp}>PAID</Text>
        )}

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {logoBase64 ? (
              <Image
                src={logoBase64}
                style={{ width: 180, height: 40, marginBottom: 4 }}
              />
            ) : (
              <Text style={styles.companyName}>SOYCRAFT</Text>
            )}
            <Text style={styles.companyDetails}>{data.companyName}</Text>
            <Text style={styles.companyDetails}>{data.companyAddress}</Text>
            <Text style={styles.companyDetails}>UEN: {data.companyUen}</Text>
            {data.companyGstReg && (
              <Text style={styles.companyDetails}>
                GST Reg: {data.companyGstReg}
              </Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" as const }}>
            <Text style={styles.companyDetails}>www.soycraft.co</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>TAX INVOICE</Text>

        {/* Invoice Info + Bill To */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Invoice Number</Text>
            <Text style={styles.infoValue}>{data.invoiceNumber}</Text>
            {data.sourceReference && (
              <>
                <Text style={styles.infoLabel}>PO Reference</Text>
                <Text style={styles.infoValue}>{data.sourceReference}</Text>
              </>
            )}
            <Text style={styles.infoLabel}>Invoice Date</Text>
            <Text style={styles.infoValue}>{data.invoiceDate}</Text>
            <Text style={styles.infoLabel}>Due Date</Text>
            <Text style={styles.infoValue}>{data.dueDate}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.billToTitle}>Bill To</Text>
            <Text style={styles.infoValue}>{data.retailerName}</Text>
            {data.outletName && (
              <Text style={styles.companyDetails}>{data.outletName}</Text>
            )}
            {data.retailerAddress && (
              <Text style={styles.companyDetails}>{data.retailerAddress}</Text>
            )}
            {data.retailerContact && (
              <Text style={styles.companyDetails}>
                Attn: {data.retailerContact}
              </Text>
            )}
            {data.retailerEmail && (
              <Text style={styles.companyDetails}>{data.retailerEmail}</Text>
            )}
          </View>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={{ ...styles.tableHeaderText, ...styles.colNo }}>
            No.
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colSku }}>
            SKU
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colProduct }}>
            Description
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colQty }}>
            Qty
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colPrice }}>
            Unit Price
          </Text>
          <Text style={{ ...styles.tableHeaderText, ...styles.colTotal }}>
            Total
          </Text>
        </View>

        {/* Product items */}
        {productItems.map((item) => {
          rowCounter++;
          return (
            <View
              key={`product-${rowCounter}`}
              style={[
                styles.tableRow,
                rowCounter % 2 === 0 ? styles.tableRowAlt : {},
              ]}
            >
              <Text style={styles.colNo}>{rowCounter}</Text>
              <Text style={styles.colSku}>{item.skuCode ?? ""}</Text>
              <Text style={styles.colProduct}>
                {item.productName ?? ""}
              </Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatSGD(item.unitPrice)}
              </Text>
              <Text style={styles.colTotal}>
                {formatSGD(item.lineTotal)}
              </Text>
            </View>
          );
        })}

        {/* Ad-hoc items section */}
        {hasAdHoc && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                Additional Items
              </Text>
            </View>
            {adHocItems.map((item) => {
              rowCounter++;
              const isNegative = item.lineTotal < 0;
              return (
                <View
                  key={`adhoc-${rowCounter}`}
                  style={[
                    styles.tableRow,
                    rowCounter % 2 === 0 ? styles.tableRowAlt : {},
                  ]}
                >
                  <Text style={styles.colNo}>{rowCounter}</Text>
                  <Text style={styles.colSku}>-</Text>
                  <Text style={styles.colProduct}>
                    {item.description ?? ""}
                  </Text>
                  <Text style={styles.colQty}>{item.quantity}</Text>
                  <Text style={styles.colPrice}>
                    {isNegative ? `(${formatSGD(Math.abs(item.unitPrice))})` : formatSGD(item.unitPrice)}
                  </Text>
                  <Text
                    style={{
                      ...styles.colTotal,
                      color: isNegative ? "#DC2626" : "#333333",
                    }}
                  >
                    {isNegative ? `(${formatSGD(Math.abs(item.lineTotal))})` : formatSGD(item.lineTotal)}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* Financial Summary */}
        <View style={styles.financialSection}>
          <View style={styles.financialBox}>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Subtotal</Text>
              <Text style={styles.financialValue}>
                SGD {formatSGD(data.subtotal)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                GST ({(data.gstRate * 100).toFixed(0)}%)
              </Text>
              <Text style={styles.financialValue}>
                SGD {formatSGD(data.gstAmount)}
              </Text>
            </View>
            <View style={styles.financialTotalRow}>
              <Text style={styles.financialTotalLabel}>TOTAL</Text>
              <Text style={styles.financialTotalValue}>
                SGD {formatSGD(data.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        {data.bankDetails && (
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Payment Details</Text>
            <Text style={styles.paymentText}>{data.bankDetails}</Text>
          </View>
        )}

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
