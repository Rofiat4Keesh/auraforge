/**
 * Pull the latest catalog from the configured supplier (SUPPLIER_SOURCE in .env)
 * and upsert it into MongoDB.
 *
 *   npm run supplier:sync
 *
 * Schedule it (e.g. every hour with cron or your hosting provider's scheduler)
 * to keep prices and stock levels in step with your wholesaler.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { getProductSource } from "../src/server/suppliers";
import { syncFromSource } from "../src/server/suppliers/sync";

async function main() {
  const prisma = new PrismaClient();
  try {
    const source = getProductSource();
    console.log(`→ Syncing catalog from source "${source.id}"...`);
    const report = await syncFromSource(prisma, source);
    console.log("✔ Sync complete");
    console.table({
      categories: report.categories,
      created: report.created,
      updated: report.updated,
      deactivated: report.deactivated,
      skipped: report.skipped.length,
    });
    for (const skip of report.skipped) {
      console.warn(`  skipped ${skip.externalId}: ${skip.reason}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("✖ Supplier sync failed:", error);
  process.exit(1);
});
