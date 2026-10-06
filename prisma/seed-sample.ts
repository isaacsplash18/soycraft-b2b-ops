import { PrismaClient } from "@prisma/client";
import { v4 as uuid } from "uuid";

const prisma = new PrismaClient();

async function main() {
  // Get admin user for created_by references
  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } });
  if (!admin) throw new Error("Run seed.ts first to create admin users");

  // ─── PRODUCTS ───
  const products = await Promise.all([
    prisma.product.create({
      data: {
        skuCode: "SC-CARRIER-BLK-M",
        name: "Soycraft Pet Carrier - Black (Medium)",
        category: "Carriers",
        msrp: 189.00,
        weightKg: 2.8,
        barcode: "8888001001",
        isActive: true,
        lowStockThreshold: 10,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-CARRIER-GRY-M",
        name: "Soycraft Pet Carrier - Grey (Medium)",
        category: "Carriers",
        msrp: 189.00,
        weightKg: 2.8,
        barcode: "8888001002",
        isActive: true,
        lowStockThreshold: 10,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-CARRIER-BLK-L",
        name: "Soycraft Pet Carrier - Black (Large)",
        category: "Carriers",
        msrp: 229.00,
        weightKg: 3.5,
        barcode: "8888001003",
        isActive: true,
        lowStockThreshold: 8,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-CARRIER-GRY-L",
        name: "Soycraft Pet Carrier - Grey (Large)",
        category: "Carriers",
        msrp: 229.00,
        weightKg: 3.5,
        barcode: "8888001004",
        isActive: true,
        lowStockThreshold: 8,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-STROLLER-BLK",
        name: "Soycraft Pet Stroller - Black",
        category: "Strollers",
        msrp: 349.00,
        weightKg: 7.2,
        barcode: "8888002001",
        isActive: true,
        lowStockThreshold: 5,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-STROLLER-GRY",
        name: "Soycraft Pet Stroller - Grey",
        category: "Strollers",
        msrp: 349.00,
        weightKg: 7.2,
        barcode: "8888002002",
        isActive: true,
        lowStockThreshold: 5,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-STROLLER-NAVY",
        name: "Soycraft Pet Stroller - Navy",
        category: "Strollers",
        msrp: 349.00,
        weightKg: 7.2,
        barcode: "8888002003",
        isActive: true,
        lowStockThreshold: 5,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-SLING-BLK",
        name: "Soycraft Pet Sling - Black",
        category: "Accessories",
        msrp: 79.00,
        weightKg: 0.4,
        barcode: "8888003001",
        isActive: true,
        lowStockThreshold: 15,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-SLING-GRY",
        name: "Soycraft Pet Sling - Grey",
        category: "Accessories",
        msrp: 79.00,
        weightKg: 0.4,
        barcode: "8888003002",
        isActive: true,
        lowStockThreshold: 15,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-RAINCOVER",
        name: "Soycraft Universal Rain Cover",
        category: "Accessories",
        msrp: 39.00,
        weightKg: 0.2,
        barcode: "8888003003",
        isActive: true,
        lowStockThreshold: 20,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-CUPHOLDER",
        name: "Soycraft Stroller Cup Holder",
        category: "Accessories",
        msrp: 19.90,
        weightKg: 0.15,
        barcode: "8888003004",
        isActive: true,
        lowStockThreshold: 25,
      },
    }),
    prisma.product.create({
      data: {
        skuCode: "SC-LINER-COOL",
        name: "Soycraft Cooling Liner Pad",
        category: "Accessories",
        msrp: 29.90,
        weightKg: 0.3,
        barcode: "8888003005",
        isActive: true,
        lowStockThreshold: 20,
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);

  // ─── RETAILERS ───
  const retailers = await Promise.all([
    prisma.retailer.create({
      data: {
        name: "Pawsome Pets (Harbourfront)",
        code: "PPVC",
        contactPerson: "Jeanette Tan",
        email: "jeanette@retailer.example",
        phone: "+6591234567",
        address: "1 HarbourFront Walk, #02-45 Harbourfront Mall, Singapore 098585",
        type: "BUYOUT",
        paymentTerms: "Net 30",
        notes: "Flagship store, high foot traffic. Reorders monthly.",
        isActive: true,
        magicToken: uuid(),
      },
    }),
    prisma.retailer.create({
      data: {
        name: "Tail Trails Pet Co.",
        code: "TPS",
        contactPerson: "Marcus Lee",
        email: "marcus@retailer.example",
        phone: "+6598765432",
        address: "321 Orchard Road, #03-12 Orchard Central, Singapore 238866",
        type: "CONSIGNMENT",
        paymentTerms: "Net 14",
        notes: "Consignment model. Reports sell-through on the 3rd of each month.",
        isActive: true,
        magicToken: uuid(),
      },
    }),
    prisma.retailer.create({
      data: {
        name: "Whisker Lodge",
        code: "NCH",
        contactPerson: "Sophia Wong",
        email: "sophia@whiskerlodge.example",
        phone: "+6587654321",
        address: "46 Joo Chiat Place, Singapore 427764",
        type: "CONSIGNMENT",
        paymentTerms: "Net 30",
        notes: "Cat-focused hotel and retail. Good for carrier display.",
        isActive: true,
        magicToken: uuid(),
      },
    }),
    prisma.retailer.create({
      data: {
        name: "Happy Paws Centre (HQ)",
        code: "PLC",
        contactPerson: "David Chua",
        email: "wholesale@happypaws.example",
        phone: "+6562345678",
        address: "7 Kaki Bukit Road 1, #01-05, Singapore 415937",
        type: "BUYOUT",
        paymentTerms: "Net 45",
        notes: "Large chain. 5-store distribution. Quarterly PO cycle.",
        isActive: true,
        magicToken: uuid(),
      },
    }),
    prisma.retailer.create({
      data: {
        name: "Fur Kids Boutique",
        code: "FKB",
        contactPerson: "Rachel Goh",
        email: "rachel@retailer.example",
        phone: "+6596543210",
        address: "112 Katong, #01-08 I12 Katong, Singapore 437949",
        type: "BUYOUT",
        paymentTerms: "COD",
        notes: "Small boutique. Cash on delivery. Orders 1-2 times a month.",
        isActive: true,
        magicToken: uuid(),
      },
    }),
  ]);

  console.log(`Created ${retailers.length} retailers`);

  // ─── RETAILER PRICING ───
  const today = new Date();
  const pricingData: { retailerIdx: number; productIdx: number; unitPrice: number }[] = [
    // Pawsome Pets - slight discount on carriers, standard on rest
    { retailerIdx: 0, productIdx: 0, unitPrice: 145.00 },
    { retailerIdx: 0, productIdx: 1, unitPrice: 145.00 },
    { retailerIdx: 0, productIdx: 2, unitPrice: 175.00 },
    { retailerIdx: 0, productIdx: 3, unitPrice: 175.00 },
    { retailerIdx: 0, productIdx: 4, unitPrice: 265.00 },
    { retailerIdx: 0, productIdx: 5, unitPrice: 265.00 },
    { retailerIdx: 0, productIdx: 7, unitPrice: 55.00 },
    { retailerIdx: 0, productIdx: 9, unitPrice: 28.00 },
    { retailerIdx: 0, productIdx: 10, unitPrice: 13.90 },
    // Tail Trails Pet Co. (consignment) - higher margin for Soycraft
    { retailerIdx: 1, productIdx: 0, unitPrice: 135.00 },
    { retailerIdx: 1, productIdx: 1, unitPrice: 135.00 },
    { retailerIdx: 1, productIdx: 4, unitPrice: 250.00 },
    { retailerIdx: 1, productIdx: 7, unitPrice: 50.00 },
    { retailerIdx: 1, productIdx: 8, unitPrice: 50.00 },
    { retailerIdx: 1, productIdx: 9, unitPrice: 25.00 },
    // Whisker Lodge (consignment) - carriers only
    { retailerIdx: 2, productIdx: 0, unitPrice: 140.00 },
    { retailerIdx: 2, productIdx: 1, unitPrice: 140.00 },
    { retailerIdx: 2, productIdx: 2, unitPrice: 170.00 },
    { retailerIdx: 2, productIdx: 3, unitPrice: 170.00 },
    // Happy Paws Centre - volume discount
    { retailerIdx: 3, productIdx: 0, unitPrice: 130.00 },
    { retailerIdx: 3, productIdx: 1, unitPrice: 130.00 },
    { retailerIdx: 3, productIdx: 2, unitPrice: 160.00 },
    { retailerIdx: 3, productIdx: 3, unitPrice: 160.00 },
    { retailerIdx: 3, productIdx: 4, unitPrice: 240.00 },
    { retailerIdx: 3, productIdx: 5, unitPrice: 240.00 },
    { retailerIdx: 3, productIdx: 6, unitPrice: 240.00 },
    { retailerIdx: 3, productIdx: 7, unitPrice: 48.00 },
    { retailerIdx: 3, productIdx: 8, unitPrice: 48.00 },
    { retailerIdx: 3, productIdx: 9, unitPrice: 24.00 },
    { retailerIdx: 3, productIdx: 10, unitPrice: 12.50 },
    { retailerIdx: 3, productIdx: 11, unitPrice: 18.00 },
    // Fur Kids Boutique - small orders, standard pricing
    { retailerIdx: 4, productIdx: 0, unitPrice: 150.00 },
    { retailerIdx: 4, productIdx: 1, unitPrice: 150.00 },
    { retailerIdx: 4, productIdx: 4, unitPrice: 270.00 },
    { retailerIdx: 4, productIdx: 7, unitPrice: 58.00 },
  ];

  for (const p of pricingData) {
    await prisma.retailerPricing.create({
      data: {
        retailerId: retailers[p.retailerIdx].id,
        productId: products[p.productIdx].id,
        unitPrice: p.unitPrice,
        effectiveFrom: today,
        effectiveTo: null,
      },
    });
  }
  console.log(`Created ${pricingData.length} pricing entries`);

  // ─── WAREHOUSE INVENTORY (restock) ───
  const stockData = [
    { productIdx: 0, qty: 45 },
    { productIdx: 1, qty: 38 },
    { productIdx: 2, qty: 22 },
    { productIdx: 3, qty: 18 },
    { productIdx: 4, qty: 15 },
    { productIdx: 5, qty: 12 },
    { productIdx: 6, qty: 8 },   // below threshold of 5? no, 8 > 5
    { productIdx: 7, qty: 30 },
    { productIdx: 8, qty: 25 },
    { productIdx: 9, qty: 4 },   // LOW STOCK - below threshold of 20
    { productIdx: 10, qty: 8 },  // LOW STOCK - below threshold of 25
    { productIdx: 11, qty: 12 }, // LOW STOCK - below threshold of 20
  ];

  for (const s of stockData) {
    await prisma.inventoryLedger.create({
      data: {
        productId: products[s.productIdx].id,
        retailerId: null,
        quantityChange: s.qty,
        movementType: "RESTOCK",
        referenceType: "manual",
        notes: "Initial stock from supplier shipment",
        createdById: admin.id,
      },
    });
  }
  console.log(`Created ${stockData.length} warehouse stock entries`);

  // ─── SAMPLE DELIVERY ORDERS ───
  // DO 1: Pawsome Pets - delivered
  const do1 = await prisma.deliveryOrder.create({
    data: {
      doNumber: "DO-202603-001",
      retailerId: retailers[0].id,
      orderDate: new Date("2026-03-05"),
      deliveryDate: new Date("2026-03-07"),
      status: "DELIVERED",
      notes: "Urgent restock for weekend sale",
      sourceReference: "WhatsApp PO from Jeanette",
      subtotal: 1720.00,
      createdById: admin.id,
      lineItems: {
        create: [
          { productId: products[0].id, quantity: 5, unitPrice: 145.00, lineTotal: 725.00 },
          { productId: products[4].id, quantity: 3, unitPrice: 265.00, lineTotal: 795.00 },
          { productId: products[7].id, quantity: 4, unitPrice: 55.00, lineTotal: 200.00 },
        ],
      },
    },
  });

  // Inventory entries for delivered DO1
  const do1Items = [
    { productIdx: 0, qty: 5 },
    { productIdx: 4, qty: 3 },
    { productIdx: 7, qty: 4 },
  ];
  for (const item of do1Items) {
    // Dispatch from warehouse
    await prisma.inventoryLedger.create({
      data: {
        productId: products[item.productIdx].id,
        retailerId: null,
        quantityChange: -item.qty,
        movementType: "DISPATCH_TO_RETAILER",
        referenceType: "delivery_order",
        referenceId: do1.id,
        createdById: admin.id,
      },
    });
  }

  // DO 2: Happy Paws Centre - confirmed but not delivered
  await prisma.deliveryOrder.create({
    data: {
      doNumber: "DO-202603-002",
      retailerId: retailers[3].id,
      orderDate: new Date("2026-03-18"),
      status: "CONFIRMED",
      notes: "Q1 restock for all 5 stores",
      sourceReference: "Email PO #PLC-2026-0312",
      subtotal: 4580.00,
      createdById: admin.id,
      lineItems: {
        create: [
          { productId: products[0].id, quantity: 10, unitPrice: 130.00, lineTotal: 1300.00 },
          { productId: products[1].id, quantity: 10, unitPrice: 130.00, lineTotal: 1300.00 },
          { productId: products[4].id, quantity: 5, unitPrice: 240.00, lineTotal: 1200.00 },
          { productId: products[7].id, quantity: 10, unitPrice: 48.00, lineTotal: 480.00 },
          { productId: products[9].id, quantity: 12, unitPrice: 24.00, lineTotal: 288.00 },
        ],
      },
    },
  });

  // DO 3: Fur Kids - draft
  await prisma.deliveryOrder.create({
    data: {
      doNumber: "DO-202603-003",
      retailerId: retailers[4].id,
      orderDate: new Date("2026-03-20"),
      status: "DRAFT",
      sourceReference: "WhatsApp: 'Hi can I order 3x black carrier M and 2x strollers?'",
      subtotal: 990.00,
      createdById: admin.id,
      lineItems: {
        create: [
          { productId: products[0].id, quantity: 3, unitPrice: 150.00, lineTotal: 450.00 },
          { productId: products[4].id, quantity: 2, unitPrice: 270.00, lineTotal: 540.00 },
        ],
      },
    },
  });

  // DO 4: Tail Trails Pet Co. (consignment) - delivered with consignment stock
  const do4 = await prisma.deliveryOrder.create({
    data: {
      doNumber: "DO-202603-004",
      retailerId: retailers[1].id,
      orderDate: new Date("2026-03-10"),
      deliveryDate: new Date("2026-03-11"),
      status: "DELIVERED",
      notes: "Initial consignment stock",
      subtotal: 1060.00,
      createdById: admin.id,
      lineItems: {
        create: [
          { productId: products[0].id, quantity: 4, unitPrice: 135.00, lineTotal: 540.00 },
          { productId: products[4].id, quantity: 2, unitPrice: 250.00, lineTotal: 500.00 },
          { productId: products[9].id, quantity: 1, unitPrice: 25.00, lineTotal: 25.00 },
        ],
      },
    },
  });

  // Consignment DO: dispatch + receive at retailer
  const do4Items = [
    { productIdx: 0, qty: 4 },
    { productIdx: 4, qty: 2 },
    { productIdx: 9, qty: 1 },
  ];
  for (const item of do4Items) {
    await prisma.inventoryLedger.create({
      data: {
        productId: products[item.productIdx].id,
        retailerId: null,
        quantityChange: -item.qty,
        movementType: "DISPATCH_TO_RETAILER",
        referenceType: "delivery_order",
        referenceId: do4.id,
        createdById: admin.id,
      },
    });
    await prisma.inventoryLedger.create({
      data: {
        productId: products[item.productIdx].id,
        retailerId: retailers[1].id,
        quantityChange: item.qty,
        movementType: "RECEIVE_AT_RETAILER",
        referenceType: "delivery_order",
        referenceId: do4.id,
        createdById: admin.id,
      },
    });
  }

  console.log("Created 4 delivery orders with inventory movements");
  console.log("\nSample data seeded successfully!");
  console.log("─────────────────────────────────");
  console.log("12 products across Carriers, Strollers, Accessories");
  console.log("5 retailers (3 buy-out, 2 consignment)");
  console.log(`${pricingData.length} pricing entries`);
  console.log("Warehouse stock with 3 low-stock alerts");
  console.log("4 DOs: 2 delivered, 1 confirmed, 1 draft");
  console.log("Consignment stock at Tail Trails Pet Co.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
