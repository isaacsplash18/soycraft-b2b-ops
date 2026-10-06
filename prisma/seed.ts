import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin users
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? "change-me", 10);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Demo Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      name: "Demo Staff",
      email: "staff@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Default settings
  const defaults = [
    { key: "company_name", value: "Soycraft Pte Ltd" },
    { key: "company_address", value: "[Address]" },
    { key: "company_uen", value: "[UEN]" },
    { key: "company_gst_reg", value: "[GST Reg No.]" },
    { key: "company_bank_details", value: "[Bank details]" },
    { key: "gst_rate", value: "0.09" },
    { key: "default_low_stock_threshold", value: "10" },
  ];

  for (const setting of defaults) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: { key: setting.key, value: setting.value },
    });
  }

  console.log("Seed complete: 2 admin users + default settings created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
