/**
 * Loads the starting catalog and demo accounts ONLY when the database has no products yet.
 * Used on every server start (Coolify / Railway), so a restart never overwrites product
 * edits made in the Admin Portal. To reload the catalog on purpose, run `npm run db:seed`.
 */
import "./load-env";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  let products = 0;
  try {
    products = await prisma.product.count();
  } finally {
    await prisma.$disconnect();
  }
  if (products > 0) {
    console.log(`✔ Database already has ${products} products — skipping the starter catalog.`);
    return;
  }
  console.log("→ Empty database: loading the starter catalog and demo accounts…");
  const result = spawnSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error("✖ seed-if-empty failed:", error);
  process.exit(1);
});
