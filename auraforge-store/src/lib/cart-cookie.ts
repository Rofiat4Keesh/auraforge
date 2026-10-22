import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { cookieBaseOptions } from "@/lib/auth";

export const CART_COOKIE = "af_cart";
const CART_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Read the cart token from the browser cookie (may be undefined for first-time visitors). */
export async function readCartToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value;
}

/** Read the cart token, creating and setting a new one if needed. Only call from route handlers. */
export async function ensureCartToken(): Promise<string> {
  const existing = await readCartToken();
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  const store = await cookies();
  store.set(CART_COOKIE, token, { ...cookieBaseOptions(), maxAge: CART_TTL_SECONDS });
  return token;
}
