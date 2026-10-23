/**
 * Safe "return to" paths for sign-in redirects (e.g. /account?next=/admin).
 * Only same-site paths are allowed, so a crafted link can never send a shopper
 * to another website after they sign in.
 */

/** Returns `value` if it is a same-site path such as "/admin/orders", otherwise `fallback`. */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback; // must be a path, not a URL
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback; // protocol-relative URL
  if (/[\u0000-\u001f\\]/.test(trimmed)) return fallback; // control characters or backslashes
  if (trimmed.length > 300) return fallback;
  return trimmed;
}

/** Messages shown on the home page when someone is turned away from the admin portal. */
export const UNAUTHORIZED_REASONS = {
  "sign-in": "Please sign in with an administrator account to open the Admin Portal.",
  forbidden: "Your account doesn't have administrator permissions.",
} as const;

export type UnauthorizedReason = keyof typeof UNAUTHORIZED_REASONS;

export function isUnauthorizedReason(value: string | null | undefined): value is UnauthorizedReason {
  return value === "sign-in" || value === "forbidden";
}
