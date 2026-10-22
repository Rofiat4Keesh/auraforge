import type { User } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Returns the signed-in admin, or null.
 * The role is re-read from the database on every request (not trusted from the login cookie),
 * so removing someone's admin role takes effect immediately.
 */
export async function getAdminUser(): Promise<User | null> {
  const session = await getSession();
  if (!session || !/^[a-f0-9]{24}$/i.test(session.userId)) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user && user.role === "ADMIN" ? user : null;
}

/** For admin API routes: throws 401 (not signed in) or 403 (signed in, not an admin). */
export async function requireAdmin(): Promise<User> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please sign in with an admin account.");
  const admin = await getAdminUser();
  if (!admin) throw new HttpError(403, "This account does not have admin access.");
  return admin;
}
