/**
 * Seeds the database with the demo catalog (or your supplier catalog if
 * SUPPLIER_SOURCE=http) and a demo customer account.
 *
 *   npm run db:seed
 *
 * Safe to run more than once — it upserts instead of duplicating.
 */
import "../scripts/load-env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getProductSource } from "../src/server/suppliers";
import { syncFromSource } from "../src/server/suppliers/sync";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Seeding AuraForge database...");

  const source = getProductSource();
  const report = await syncFromSource(prisma, source);
  console.log(
    `✔ Catalog from "${report.source}": ${report.categories} categories, ${report.created} products created, ${report.updated} updated.`,
  );

  // Demo accounts (known passwords) are for local testing ONLY. They are created only when
  // SEED_DEMO_ACCOUNTS="true", so a production database never gets a publicly known admin login.
  // Real admins are created from ADMIN_EMAIL / ADMIN_PASSWORD (see scripts/seed-if-empty.ts)
  // or with `npm run seed:admin`.
  if (process.env.SEED_DEMO_ACCOUNTS !== "true") {
    console.log("✔ Demo accounts skipped (set SEED_DEMO_ACCOUNTS=\"true\" only on your own computer to create them).");
    return;
  }

  const demoEmail = "demo@auraforge.test";
  const passwordHash = await bcrypt.hash("Demo12345!", 10);
  await prisma.user.upsert({
    where: { email: demoEmail },
    create: { email: demoEmail, fullName: "Demo Customer", phone: "08030000000", passwordHash },
    update: {},
  });
  console.log(`✔ Demo login → email: ${demoEmail}  password: Demo12345!`);

  const adminEmail = "admin@auraforge.test";
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: "Store Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("Admin12345!", 10),
    },
    update: { role: "ADMIN" },
  });
  console.log(`✔ Demo ADMIN → email: ${adminEmail}  password: Admin12345!  (local testing only)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("✔ Seed finished.");
  })
  .catch(async (error) => {
    console.error("✖ Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
