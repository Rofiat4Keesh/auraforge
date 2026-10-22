import { PrismaClient } from "@prisma/client";

/**
 * A single shared Prisma client.
 * In development Next.js hot-reloads modules, which would otherwise open a new
 * database connection on every save. Caching the client on globalThis prevents that.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
