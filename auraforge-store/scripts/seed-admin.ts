/**
 * npm run seed:admin
 *
 * Creates the first Admin Portal account (or upgrades an existing account to ADMIN).
 * It reads these values from your .env file:
 *
 *   ADMIN_EMAIL="owner@yourdomain.ng"
 *   ADMIN_PASSWORD="a-strong-password"      (at least 10 characters)
 *   ADMIN_NAME="Your Full Name"
 *
 * You can also pass them on the command line instead:
 *   npm run seed:admin -- --email owner@yourdomain.ng --password "a-strong-password" --name "Your Name"
 *
 * Safe to run more than once:
 *   - no account with that email yet  -> a new ADMIN account is created
 *   - account already exists          -> its role becomes ADMIN; the password is changed
 *                                        only if you add --reset-password
 *
 * Afterwards: open the shop, click "Sign In", sign in with that email and password,
 * and an "Admin Portal" link appears in the header.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "";
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = arg("password") ?? process.env.ADMIN_PASSWORD ?? "";
  const name = (arg("name") ?? process.env.ADMIN_NAME ?? "").trim();
  const resetPassword = process.argv.includes("--reset-password");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set ADMIN_EMAIL in your .env file (e.g. ADMIN_EMAIL="owner@yourdomain.ng"), or pass --email.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Copy .env.example to .env and fill it in first.");
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const data: { role: "ADMIN"; passwordHash?: string; fullName?: string } = { role: "ADMIN" };
      if (resetPassword) {
        if (password.length < 10) throw new Error("--reset-password needs ADMIN_PASSWORD (or --password) of at least 10 characters.");
        data.passwordHash = await bcrypt.hash(password, 12);
      }
      if (name && name !== existing.fullName) data.fullName = name;
      await prisma.user.update({ where: { email }, data });
      console.log(
        existing.role === "ADMIN"
          ? `✔ ${email} was already an admin.${resetPassword ? " Password updated." : ""}`
          : `✔ ${email} is now an admin.${resetPassword ? " Password updated." : " Their existing password still works."}`,
      );
    } else {
      if (password.length < 10) {
        throw new Error('Set ADMIN_PASSWORD in your .env file (at least 10 characters), e.g. ADMIN_PASSWORD="Choose-a-long-one-2026".');
      }
      await prisma.user.create({
        data: { email, fullName: name.length >= 2 ? name : "Store Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
      });
      console.log(`✔ Admin account created for ${email}.`);
    }

    console.log("  Next: open the shop, click Sign In, sign in with this email, then click “Admin Portal” in the header.");
    console.log("  Tip: remove ADMIN_PASSWORD from .env now that the account exists.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
