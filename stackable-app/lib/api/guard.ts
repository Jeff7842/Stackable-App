// =============================================================================
// requireAuth — the one guard every protected API route calls.
// -----------------------------------------------------------------------------
// It answers four questions before a route runs:
//   1. Are you signed in?            -> 401 if not
//   2. Do you have the right role?   -> 403 if not (when `roles` given)
//   3. Are you allowed on this page? -> 403 if not (when `pageKey` given)
//   4. Are you going too fast?       -> 429 if over the limit (when enabled)
// It returns { userId, schoolId, role } so the route can scope data to ONE
// school — never trusting a school id from the request body.
//
// SESSION SOURCE (interim): we validate the existing `stackable_session` cookie
// against the legacy `user_sessions` table (still written by the current login).
// In Step 7 (Better Auth) we swap `resolveSession` for Better Auth's session —
// nothing else in this file changes.
// =============================================================================

import { cookies } from "next/headers";
import { hashToken } from "@/lib/auth-utils";
import { createSupabaseClient } from "@/lib/supabase/supabase-admin";
import type { Role, PageKey } from "@/lib/validation/shared";
import { ApiError, forbidden, unauthorized } from "./errors";
import { enforceRateLimit, type RateLimitKind } from "./ratelimit";

export type AuthContext = {
  userId: string;
  schoolId: string;
  schoolCode: string;
  role: Role;
};

export type RequireAuthOptions = {
  /** If set, the user's role must be one of these. */
  roles?: Role[];
  /** If set, the user needs can_access=true for this page (super-admin bypasses). */
  pageKey?: PageKey;
  /** If set, apply this rate limiter keyed by the user id. */
  rateLimit?: RateLimitKind;
};

const SESSION_COOKIE = "stackable_session";

/** Read and validate the current session cookie. Returns null if not signed in. */
async function resolveSession(): Promise<AuthContext | null> {
  // ── Better Auth path (Step 7 flip) ──────────────────────────────────────────
  // When AUTH_PROVIDER=betterauth, delegate entirely to Better Auth's session.
  // The legacy cookie path below is skipped.
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

  const { data, error } = await createSupabaseClient
    .from("user_sessions")
    .select("user_id, school_id, revoked_at, expires_at, users(role, status, school_code)")
    .eq("refresh_token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Supabase returns the joined user as an object (or array depending on shape).
  const joined = (data as { users?: unknown }).users;
  const user = Array.isArray(joined) ? joined[0] : joined;
  const u = user as { role?: string; status?: string; school_code?: string } | undefined;
  if (!u || u.status !== "active") return null;

  return {
    userId: data.user_id as string,
    schoolId: data.school_id as string,
    schoolCode: u.school_code ?? "",
    role: (u.role ?? "") as Role,
  };
}

/** Apply a rate limit, but don't fail closed if Redis isn't configured yet. */
async function maybeRateLimit(kind: RateLimitKind, identifier: string): Promise<void> {
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
 */
export async function requireAuth(
  _req: Request,
  opts: RequireAuthOptions = {},
): Promise<AuthContext> {
  const ctx = await resolveSession();
  if (!ctx) throw unauthorized();

  if (opts.roles && !opts.roles.includes(ctx.role)) {
    throw forbidden("Your role can't perform this action.");
  }

  // Fine-grained page permission. super-admin always passes. We only DENY when
  // an explicit row says can_access=false; absence of a row is treated as
  // allowed (the live database has no permission rows yet).
  if (opts.pageKey && ctx.role !== "super-admin") {
    const { data } = await createSupabaseClient
      .from("user_page_permissions")
      .select("can_access")
      .eq("user_id", ctx.userId)
      .eq("page_key", opts.pageKey)
      .maybeSingle();
    if (data && data.can_access === false) {
      throw forbidden("You don't have access to this page.");
    }
  }

  if (opts.rateLimit) {
    await maybeRateLimit(opts.rateLimit, ctx.userId);
  }

  return ctx;
}
