import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Admin auth gate.
 *
 * The proxy runs in the edge runtime so it can't import prisma. It only
 * checks for the presence of the `admin_session` cookie. The actual session
 * validity is checked downstream by `getCurrentAdmin()` inside server
 * components and API routes — if the cookie is invalid/expired, those
 * paths will reject with 401 / redirect, which is fine.
 *
 * Allowed without auth:
 *   • /admin/login                           (the login page itself)
 *   • /api/admin/auth/login | /logout         (auth endpoints)
 */

const ADMIN_COOKIE = "admin_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Don't gate the login page or auth endpoints
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/auth/")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token) return NextResponse.next();

  // No cookie — block access
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Browsing → redirect to login (preserve intended destination via ?next)
  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
