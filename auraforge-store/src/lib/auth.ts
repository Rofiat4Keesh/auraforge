import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export { SESSION_COOKIE, createSessionToken };
export type { SessionPayload };

export function cookieBaseOptions() {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...cookieBaseOptions(), maxAge: SESSION_TTL_SECONDS });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieBaseOptions(), maxAge: 0 });
}

/** Returns the logged-in user's session, or null for guests / invalid tokens. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
