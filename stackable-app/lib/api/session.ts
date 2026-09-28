// =============================================================================
// Session helpers that need NO server-only imports.
// -----------------------------------------------------------------------------
// This file is shared by proxy.ts (which must stay tiny and must not pull in
// Supabase/Prisma) and lib/api/guard.ts. Keep it free of I/O so it can be unit
// tested and imported from anywhere, including client components.
//
// Contents:
//   - the session cookie names (legacy + Better Auth)
//   - roleGate(): the pure "may this role enter this portal?" decision
//   - safeNextPath(): open-redirect-safe check for a `?next=` value
// =============================================================================

import {
  PORTAL_ROLES,
  ROLE_HOME,
  type Portal,
  type Role,
} from "@/lib/validation/shared";

/** Legacy session cookie written by /api/auth/verify-otp (httpOnly). */
export const SESSION_COOKIE = "stackable_session";

/**
 * Better Auth session cookie: `<prefix>.session_token`, where the prefix is
 * "better-auth" and gets a "__Secure-" prefix on https (we set neither option
 * in lib/auth/auth.ts, so these are the defaults). Both are listed so that
 * flipping AUTH_PROVIDER=betterauth never makes the proxy think the user is
 * signed out.
 */
export const BETTER_AUTH_SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/** Every cookie name that means "this browser has a session". */
export const ANY_SESSION_COOKIES: readonly string[] = [
  SESSION_COOKIE,
  ...BETTER_AUTH_SESSION_COOKIES,
];

// The URL prefix each portal serves. Used only to detect a redirect loop.
const PORTAL_HOME: Record<Portal, string> = {
  developer: "/dev",
  principal: "/admin",
  dashboard: "/dashboard",
  teacher: "/teach",
  student: "/learn",
  parent: "/family",
};

export type RoleGateResult =
  | { allowed: true }
  | { allowed: false; redirectTo: string };

/**
 * Decide whether `role` may enter `portal`; if not, say where to send them.
 *
 * Why it exists: requireRole() (server layouts) needs one tiny, testable rule.
 * An unknown/empty role, or a role whose home page is the portal that just
 * rejected it, goes to /login instead, so a bad config can never loop.
 *
 * @param role   the signed-in user's role (may be an unknown string at runtime)
 * @param portal the portal being entered
 */
export function roleGate(role: Role, portal: Portal): RoleGateResult {
  if (PORTAL_ROLES[portal].includes(role)) return { allowed: true };

  const home = ROLE_HOME[role] as string | undefined;
  // Never send a rejected user to the portal that just rejected them.
  if (!home || home === PORTAL_HOME[portal]) return { allowed: false, redirectTo: "/login" };
  return { allowed: false, redirectTo: home };
}

const MAX_NEXT_LENGTH = 2048; // sanity cap; real paths are far shorter
const NEXT_BASE = "http://next-check.invalid"; // never resolved, only used to parse
// C0 control characters and DEL: browsers strip some of these inside URLs,
// which is a classic way to smuggle "//evil.com" past a naive check.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Return a same-origin relative path that is safe to redirect to, or null.
 *
 * Why it exists: `?next=` lets a user land where they were going after login,
 * but an unchecked value is an open redirect ("/login?next=https://evil.com").
 * Only a single-slash relative path on OUR origin is accepted.
 *
 * @param raw the untrusted `next` value (query string, cookie, ...)
 * @returns e.g. "/dashboard/students?x=1", or null when unsafe/empty
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_NEXT_LENGTH) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null; // absolute or protocol-relative
  if (raw.includes("\\") || CONTROL_CHARS.test(raw)) return null; // "/\evil.com" is treated as "//evil.com"

  let parsed: URL;
  try {
    parsed = new URL(raw, NEXT_BASE);
  } catch {
    return null; // unparsable input is not a path we want to redirect to
  }
  if (parsed.origin !== NEXT_BASE) return null; // parser resolved it to another host
  return parsed.pathname + parsed.search;
}
