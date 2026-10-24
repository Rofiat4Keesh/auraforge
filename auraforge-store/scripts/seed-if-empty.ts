/**
 * Start-up data tasks, run on every server start (Coolify / Railway / Docker):
 *
 *  1. Loads the starter catalog ONLY when the database has no products yet, so a restart never
 *     overwrites product edits made in the Admin Portal. (Reload on purpose with `npm run db:seed`.)
 *  2. If ADMIN_EMAIL and ADMIN_PASSWORD are set (as secrets in your host), makes sure that account
 *     exists and is an ADMIN, so a fresh deployment always has your administrator and nobody else.
 *     An existing account keeps its current password; the password is only used when creating it.
 */
import "./load-env";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

function run(args: string[], { fatal }: { fatal: boolean }) {
  const result = spawnSync("npx", ["tsx", ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0 && fatal) process.exit(result.status ?? 1);
  return result.status === 0;
}

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
  } else {
    console.log("→ Empty database: loading the starter catalog…");
    run(["prisma/seed.ts"], { fatal: true });
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    console.log("→ Ensuring the administrator from ADMIN_EMAIL exists…");
    // Not fatal: a mistake in these settings is reported in the log but never stops the shop from starting.
    if (!run(["scripts/seed-admin.ts"], { fatal: false })) {
      console.error("✖ Could not create the administrator — check ADMIN_EMAIL / ADMIN_PASSWORD (10+ characters).");
    }
  } else {
    console.log("ℹ ADMIN_EMAIL / ADMIN_PASSWORD not set — no administrator created automatically. Use `npm run seed:admin`.");
  }
}

main().catch((error) => {
  console.error("✖ Start-up data tasks failed:", error);
  process.exit(1);
});
