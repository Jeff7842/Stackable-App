// =============================================================================
// proxy.ts — the front door for dashboard pages (Next.js 16 "proxy", formerly
// "middleware"). It must live at the project ROOT, next to package.json.
// -----------------------------------------------------------------------------
// Job: if someone opens a dashboard URL with NO session cookie at all, send them
// to /login before any page code runs. It checks that a cookie EXISTS and nothing
// more: the real checks (session valid, user active, role allowed) happen in the
// server layouts (requireRole) and in the API (requireAuth). Do not add database
// calls here; this runs on every dashboard request.
//
// Both cookies count as "signed in": the legacy `stackable_session` and Better
// Auth's `better-auth.session_token` (also with the `__Secure-` prefix), so
// switching AUTH_PROVIDER=betterauth later does not cause a redirect loop.
//
// Runs on the Node.js runtime (the only runtime proxy supports).
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { ANY_SESSION_COOKIES, safeNextPath } from "@/lib/api/session";

/**
 * Redirect cookie-less requests for protected pages to /login.
 *
 * Why it exists: without it any URL under /dashboard, /admin, ... rendered for
 * anyone and only the API refused to give data.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = ANY_SESSION_COOKIES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );
  if (hasSessionCookie) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";

  // Remember where they were headed, but only as a same-origin relative path so
  // /login?next=... can never be turned into an open redirect. The login page
  // must run the value through safeNextPath() again before using it.
  const next = safeNextPath(request.nextUrl.pathname + request.nextUrl.search);
  if (next) loginUrl.searchParams.set("next", next);

  return NextResponse.redirect(loginUrl);
}

// The matcher must be a literal (Next reads it statically at build time).
// `/dev/:path*` matches "/dev" and "/dev/anything" but NOT "/developers";
// the same goes for "/learning", "/admin-tools" and so on. Everything else
// (/, /login, /forgot-password, /our-story, /api/*, /_next/*, images, favicon)
// is simply not listed, so the proxy never runs for it.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/teach/:path*",
    "/learn/:path*",
    "/family/:path*",
    "/dev/:path*",
  ],
};
