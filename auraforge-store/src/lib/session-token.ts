/**
 * Session token helpers with no Next.js imports, so they work both in normal server code
 * and in src/middleware.ts (which runs on the Edge runtime).
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "af_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters. Set it in your .env file.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Returns the session inside a token, or null for a missing, tampered or expired token. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email, role: payload.role === "ADMIN" ? "ADMIN" : "CUSTOMER" };
  } catch {
    return null;
  }
}
