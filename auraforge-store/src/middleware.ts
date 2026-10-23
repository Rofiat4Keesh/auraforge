/**
 * Role-based protection for the admin portal. Runs before any /admin page or
 * /api/admin endpoint.
 *
 *  - Pages (/admin, /admin/*): anyone who is not signed in as an ADMIN is sent to the
 *    home page, which shows an "Unauthorized Access" alert:
 *        not signed in        -> /?unauthorized=sign-in
 *        signed in, CUSTOMER  -> /?unauthorized=forbidden
 *  - API (/api/admin/*): answers 401 (not signed in) or 403 (not an admin) as JSON.
 *
 * The middleware reads the role from the signed session cookie, so it is fast. Every
 * admin page and API handler then re-checks the role in the database (getAdminUser /
 * requireAdmin in src/lib/admin-guard.ts), so removing someone's admin access takes
 * effect on their very next click.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isAdmin = session?.role === "ADMIN";

  if (pathname.startsWith("/api/admin")) {
    if (isAdmin) return NextResponse.next();
    return NextResponse.json(
      {
        success: false,
        error: {
          message: session
            ? "Unauthorized Access: this account does not have administrator permissions."
            : "Unauthorized Access: please sign in with an administrator account.",
          details: { code: session ? "FORBIDDEN" : "UNAUTHENTICATED" },
        },
      },
      { status: session ? 403 : 401 },
    );
  }

  if (!isAdmin) {
    const home = new URL("/", request.url);
    home.searchParams.set("unauthorized", session ? "forbidden" : "sign-in");
    return NextResponse.redirect(home);
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
