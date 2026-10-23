import type { NextRequest } from "next/server";
import { handle, ok, readJson } from "@/lib/http";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/auth";
import { readCartToken } from "@/lib/cart-cookie";
import { loginSchema, registerSchema } from "@/lib/validators";
import {
  attachCartToUser,
  authenticate,
  getUserById,
  registerUser,
  toSessionUser,
} from "@/server/services/user.service";

/** POST /api/auth/register { fullName, email, phone?, password } */
export const registerController = handle(async (req: NextRequest) => {
  const input = registerSchema.parse(await readJson(req));
  const user = await registerUser({ ...input, phone: input.phone || undefined });
  await setSessionCookie({ userId: user.id, email: user.email, role: user.role });
  await attachCartToUser(await readCartToken(), user.id);
  return ok(toSessionUser(user), 201);
});

/** POST /api/auth/login { email, password } */
export const loginController = handle(async (req: NextRequest) => {
  const input = loginSchema.parse(await readJson(req));
  const user = await authenticate(input.email, input.password);
  await setSessionCookie({ userId: user.id, email: user.email, role: user.role });
  await attachCartToUser(await readCartToken(), user.id);
  return ok(toSessionUser(user));
});

/** POST /api/auth/logout */
export const logoutController = handle(async () => {
  await clearSessionCookie();
  return ok({ loggedOut: true });
});

/**
 * GET /api/auth/me — current user or null.
 * Also brings the session cookie up to date: the role is stored inside the signed cookie
 * (the middleware reads it there), so when `npm run seed:admin` or Admin -> Customers changes
 * someone's role, this call re-issues their cookie and the Admin Portal link works without
 * signing out and back in. A cookie for a deleted account is cleared.
 */
export const meController = handle(async () => {
  const session = await getSession();
  if (!session) return ok(null);
  const user = await getUserById(session.userId);
  if (!user) {
    await clearSessionCookie();
    return ok(null);
  }
  if (user.role !== session.role || user.email !== session.email) {
    await setSessionCookie({ userId: user.id, email: user.email, role: user.role });
  }
  return ok(toSessionUser(user));
});
