// =============================================================================
// requireAuth — the one guard every protected API route calls.
// -----------------------------------------------------------------------------
// It answers these questions before a route runs:
//   1. Are you signed in?            -> 401 if not
//   2. Do you have the right role?   -> 403 if not (when `roles` given)
//   3. Are you "viewing as" someone and this action forbids that? -> 403
//   4. Are you allowed on this page? -> 403 if not (when `pageKey` given)
//   5. Are you going too fast?       -> 429 if over the limit (when enabled)
//   6. While a super-admin views as another user, is this change recorded? -> 500 if not
// It returns { userId, schoolId, role } so the route can scope data to ONE
// school — never trusting a school id from the request body.
//
// SESSION SOURCE (interim): we validate the existing `stackable_session` cookie
// against the `user_sessions` table in PostgreSQL via Prisma (written by the current login).
// In Step 7 (Better Auth) we swap `resolveSession` for Better Auth's session —
// nothing else in this file changes.
//
// IMPERSONATION (developer console): when a real, active super-admin carries a valid
// `stackable_impersonation` cookie, resolveSession() returns the TARGET user's context
// plus `impersonatedBy`. All the rules live in lib/api/impersonation.ts. It only ever
// grants access after every check passes; any error falls back to the real user.
// =============================================================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashToken } from "@/lib/auth-utils";
import { findLiveSession, isPageAllowed } from "@/lib/repositories/auth.repo";
import type { Role, PageKey, Portal } from "@/lib/validation/shared";
import { ApiError, forbidden, unauthorized } from "./errors";
import {
  AUDIT_ACTION_REQUEST,
  IMPERSONATION_COOKIE,
  describeRequest,
  enforceAudit,
  isReadMethod,
  resolveImpersonation,
  writeAuditLog,
  type ImpersonatedBy,
} from "./impersonation";
import { enforceRateLimit, type RateLimitKind } from "./ratelimit";
import { SESSION_COOKIE, roleGate } from "./session";

export type AuthContext = {
  userId: string;
  schoolId: string;
  schoolCode: string;
  role: Role;
  /** The REAL user_sessions.id of the signed-in browser (legacy path only). */
  sessionId?: string;
  /**
   * Set only while a real super-admin is viewing as this user. The context above is then the
   * TARGET's; this says who is really behind the request.
   */
  impersonatedBy?: ImpersonatedBy;
};

export type RequireAuthOptions = {
  /** If set, the user's role must be one of these. */
  roles?: Role[];
  /** If set, the user needs can_access=true for this page (super-admin bypasses). */
  pageKey?: PageKey;
  /** If set, apply this rate limiter keyed by the user id. */
  rateLimit?: RateLimitKind;
  /**
   * If true, refuse the request while a super-admin is viewing as another user.
   * Use it on the sensitive routes (deleting users/schools, security codes, ...).
   */
  denyImpersonation?: boolean;
};

/**
 * One implementation of "who is this request?", shared by resolveSession() and
 * resolveRealSession(). Only `applyImpersonation` differs between them.
 */
async function resolveContext(applyImpersonation: boolean): Promise<AuthContext | null> {
  // ── Better Auth path (Step 7 flip) ──────────────────────────────────────────
  // When AUTH_PROVIDER=betterauth, delegate entirely to Better Auth's session.
  // The legacy cookie path below is skipped.
  // NOTE: impersonation is LEGACY-PATH ONLY; this branch never impersonates.
  if (process.env.AUTH_PROVIDER === "betterauth") {
    const { auth } = await import("@/lib/auth/auth");
    const { headers } = await import("next/headers");
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    // Better Auth user carries our custom fields (schoolId, role, status).
    const u = session.user as {
      schoolId?: string;
      role?: string;
      school_code?: string;
      status?: string;
    };
    // Block suspended / pending accounts the same way the legacy path does.
    if (u.status !== undefined && u.status !== "active") return null;
    return {
      userId: session.user.id,
      schoolId: u.schoolId ?? "",
      schoolCode: u.school_code ?? "",
      role: (u.role ?? "") as import("@/lib/validation/shared").Role,
    };
  }
  // ── Legacy path (default) ────────────────────────────────────────────────────
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let session;
  try {
    session = await findLiveSession(hashToken(token), new Date());
  } catch (err) {
    // A database outage must read as "not signed in", never as an error page with a stack trace.
    console.error("[guard] session lookup failed:", (err as Error).message);
    return null;
  }
  if (!session || session.users.status !== "active") return null;

  const u = session.users;
  const real: AuthContext = {
    userId: session.user_id,
    schoolId: session.school_id,
    schoolCode: u.school_code ?? "",
    role: (u.role ?? "") as Role,
    sessionId: session.id,
  };

  if (!applyImpersonation) return real;

  // The common case (no cookie) does no extra work. resolveImpersonation() also checks the
  // REAL role before it reads any impersonation table, and never throws: on any failure it
  // returns null and the request stays the real user, never the target.
  const impersonationCookie = store.get(IMPERSONATION_COOKIE)?.value;
  if (!impersonationCookie) return real;

  const actorName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || "Developer";
  const resolved = await resolveImpersonation(
    { userId: real.userId, role: real.role, sessionId: real.sessionId, name: actorName },
    impersonationCookie,
  );
  if (!resolved) return real;

  return {
    userId: resolved.identity.userId,
    schoolId: resolved.identity.schoolId,
    schoolCode: resolved.identity.schoolCode,
    role: resolved.identity.role,
    sessionId: real.sessionId, // always the REAL session, never the target's
    impersonatedBy: resolved.impersonatedBy,
  };
}

/**
 * Read and validate the current session. Returns null if not signed in.
 * Exported so server layouts (requireRole) and future wrappers share one source
 * of truth for "who is this request?". SERVER-ONLY: it reads request cookies.
 *
 * While a super-admin is viewing as another user this returns the TARGET's context
 * (with `impersonatedBy` set), so every page and API behaves exactly as it does for them.
 */
export async function resolveSession(): Promise<AuthContext | null> {
  return resolveContext(true);
}

/**
 * The same lookup as resolveSession() but NEVER applies impersonation: always the real
 * signed-in user. Used by the impersonation start/stop routes, which must know who the
 * actor really is even while they are viewing as someone else.
 */
export async function resolveRealSession(): Promise<AuthContext | null> {
  return resolveContext(false);
}

/**
 * Apply a rate limit, but don't fail closed if Redis isn't configured yet.
 * Exported so routes that do not use requireAuth (impersonation start/stop) limit the same way.
 */
export async function maybeRateLimit(kind: RateLimitKind, identifier: string): Promise<void> {
  try {
    await enforceRateLimit(kind, identifier);
  } catch (err) {
    if (err instanceof ApiError) throw err; // a real 429 — propagate
    // Redis not configured / unreachable: log once and allow through.
    console.warn(`[guard] rate limit skipped (${kind}):`, (err as Error).message);
  }
}

/**
 * Gate a route. Throws ApiError (caught by toErrorResponse) on failure, or
 * returns the authenticated context on success.
 *
 * Order: resolve -> role -> denyImpersonation -> page permission -> rate limit -> audit.
 */
export async function requireAuth(
  req: Request,
  opts: RequireAuthOptions = {},
): Promise<AuthContext> {
  const ctx = await resolveSession();
  if (!ctx) throw unauthorized();

  if (opts.roles && !opts.roles.includes(ctx.role)) {
    throw forbidden("Your role can't perform this action.");
  }

  if (opts.denyImpersonation && ctx.impersonatedBy) {
    throw forbidden("This action is not allowed while viewing as another user.");
  }

  // Fine-grained page permission. super-admin always passes. We only DENY when
  // an explicit row says can_access=false; absence of a row is treated as
  // allowed (the live database has no permission rows yet).
  if (opts.pageKey && ctx.role !== "super-admin") {
    if (!(await isPageAllowed(ctx.userId, opts.pageKey))) {
      throw forbidden("You don't have access to this page.");
    }
  }

  if (opts.rateLimit) {
    await maybeRateLimit(opts.rateLimit, ctx.userId);
  }

  // Every change made while viewing as someone else is recorded BEFORE the handler runs.
  // FAIL CLOSED: if the record cannot be written, the change must not happen.
  const viewer = ctx.impersonatedBy;
  if (viewer && !isReadMethod(req.method)) {
    const meta = describeRequest(req);
    await enforceAudit(() =>
      writeAuditLog({
        schoolId: ctx.schoolId || null,
        actorUserId: viewer.id, // the real super-admin
        targetUserId: ctx.userId, // the account being viewed
        action: AUDIT_ACTION_REQUEST,
        method: req.method.toUpperCase(),
        path: meta.path,
        metadata: { impersonationSessionId: viewer.sessionRowId },
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    );
  }

  return ctx;
}

/**
 * Gate a PAGE (server layout) to one portal.
 *
 * What it does: no session -> redirect to /login; a role that may not enter
 * this portal -> redirect to that role's own home; otherwise returns the context.
 *
 * Why it exists: the proxy only checks that a cookie EXISTS. This is the real
 * check (session valid, user active, role allowed) and it runs on the server
 * before any dashboard HTML is sent.
 *
 * SERVER-ONLY (call it from a server layout, never from a client component).
 * Never wrap it in try/catch: redirect() works by throwing NEXT_REDIRECT.
 * Note: layouts do not re-render on client-side navigation between their child
 * pages, so the API (requireAuth) stays the real enforcement point for data.
 *
 * @param portal which portal the calling layout protects
 * @returns the authenticated context (only reached when access is allowed)
 */
export async function requireRole(portal: Portal): Promise<AuthContext> {
  const ctx = await resolveSession();
  if (!ctx) redirect("/login");

  const verdict = roleGate(ctx.role, portal);
  if (!verdict.allowed) redirect(verdict.redirectTo);

  return ctx;
}
