/**
 * Give a user admin access (or create a new admin account).
 *
 *   Promote an existing account (sign up on the site first):
 *     npm run admin:create -- --email you@example.com
 *
 *   Create a brand-new admin account:
 *     npm run admin:create -- --email you@example.com --password "StrongPass123" --name "Your Name"
 *
 *   Remove admin access:
 *     npm run admin:create -- --email someone@example.com --revoke
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
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  const name = arg("name")?.trim();
  const revoke = process.argv.includes("--revoke");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✖ Please pass a valid email, e.g.  npm run admin:create -- --email you@example.com");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (revoke) {
      if (!existing) throw new Error(`No account found for ${email}.`);
      await prisma.user.update({ where: { email }, data: { role: "CUSTOMER" } });
      console.log(`✔ Admin access removed from ${email}.`);
      return;
    }

    if (existing) {
      if (password) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        await prisma.user.update({
          where: { email },
          data: { role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
        });
        console.log(`✔ ${email} is now an admin, and the password was reset.`);
      } else {
        await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
        console.log(`✔ ${email} is now an admin. Sign in on the shop, then click “Admin Portal” in the header.`);
      }
      return;
    }

    if (!password || password.length < 8 || !name) {
      throw new Error(
        `No account exists for ${email}. To create one, also pass --password (8+ characters) and --name "Full Name".`,
      );
    }
    await prisma.user.create({
      data: { email, fullName: name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`✔ Admin account created for ${email}. Sign in on the shop, then click “Admin Portal” in the header.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("✖", error instanceof Error ? error.message : error);
  process.exit(1);
});
