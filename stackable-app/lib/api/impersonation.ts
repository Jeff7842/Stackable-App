// =============================================================================
// Impersonation — the developer console's "view as another user".
// -----------------------------------------------------------------------------
// A real super-admin can act as a teacher / parent / student / admin for up to an
// hour, with a written reason, to see exactly what that person sees. This file
// holds every rule of that feature so the guard, the start/stop routes and the
// check script share ONE definition:
//
//   Section 1  PURE helpers   no I/O; unit-checked by lib/api/impersonation.check.ts.
//   Section 2  Decision       decideImpersonation() + resolveImpersonation(): the
//                             security-critical "who is this request?" rules.
//   Section 3  DB functions   re-exported from lib/repositories/impersonation.repo.ts
//                             (Prisma + PostgreSQL). This file never touches the
//                             database itself; resolveImpersonation() takes its two
//                             reads as injectable `deps`, so tests use stubs.
//
// THE SAFETY RULE THAT MATTERS MOST: impersonation may only ever ADD access after
// every check passes. Any error, missing table or failed check means "not
// impersonating" and the request stays the REAL user (the actor), never the
// target. Nothing here throws into the auth path.
//
// Provider-agnostic: guard.ts's resolveContext() calls applyImpersonationIfAny()
// from BOTH the legacy and Better Auth branches, once it has resolved the real
// signed-in user's {userId, role, sessionId}. Nothing in this file cares which
// session mechanism produced that triple.
// =============================================================================

import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { hashToken } from "../auth-utils";
import {
  createImpersonation,
  endImpersonation,
  findActiveImpersonation,
  loadImpersonationTarget,
  writeAuditLog,
  type FindActiveParams,
  type ImpersonationRow,
  type ImpersonationTarget,
} from "@/lib/repositories/impersonation.repo";
import { ROLES, type Role } from "../validation/shared";
import { ApiError } from "./errors";

// The DB functions and their types live in the repository; they are re-exported here so the
// guard and the dev console keep one import path for everything impersonation.
export { createImpersonation, endImpersonation, findActiveImpersonation, loadImpersonationTarget, writeAuditLog };
export type {
  AuditEntry,
  CreateImpersonationParams,
  EndFilter,
  FindActiveParams,
  ImpersonationRow,
  ImpersonationTarget,
} from "@/lib/repositories/impersonation.repo";

// =============================================================================
// Section 1 — constants and PURE helpers
// =============================================================================

/** Cookie that carries the (random) impersonation token. httpOnly, never readable by JS. */
export const IMPERSONATION_COOKIE = "stackable_impersonation";

/** One viewing window lasts an hour; the actor must start again after that. */
export const IMPERSONATION_TTL_SECONDS = 60 * 60;

/** A reason forces the developer to say why they are looking at someone's account. */
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

// audit_logs.user_agent / path are free text; cap them so one huge header cannot bloat the table.
export const USER_AGENT_MAX_LENGTH = 300;
const PATH_MAX_LENGTH = 500;

// 45 chars is the longest textual IPv6 address (IPv4-mapped form included).
const IP_MAX_LENGTH = 45;

// 32 random bytes = 256 bits of entropy; base64url encodes that as exactly 43 characters.
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Audit action names, shared by writers and by the dev audit viewer. */
export const AUDIT_ACTION_START = "impersonation.start";
export const AUDIT_ACTION_STOP = "impersonation.stop";
export const AUDIT_ACTION_REQUEST = "impersonation.request";

export const AUDIT_UNAVAILABLE_MESSAGE = "Audit log unavailable";
export const TABLES_MISSING_MESSAGE =
  "Impersonation tables are not installed. Run the database migrations (pnpm db:deploy).";

// Control characters (C0 + DEL). A NUL byte in a text/jsonb column makes Postgres reject the
// whole INSERT, and because auditing is fail-closed that would turn into a 500 on every request.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
// Same as above but keeps tab (\u0009) and newline (\u000a) for the free-text reason.
const CONTROL_CHARS_KEEP_WHITESPACE = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
// A UTF-16 surrogate with no partner (e.g. an emoji sliced in half). Postgres jsonb rejects it.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** True for methods that never change data (they are not audited while impersonating). */
export function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method.toUpperCase());
}

export type ImpersonationCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * Cookie options for the impersonation cookie.
 *
 * Why: httpOnly keeps the token away from page scripts; sameSite=lax stops the cookie riding on
 * cross-site POSTs; `secure` is production-only because http://localhost cannot set secure cookies.
 *
 * @param nodeEnv value of NODE_ENV (a parameter so the check script can test both branches)
 */
export function impersonationCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ImpersonationCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
    maxAge: IMPERSONATION_TTL_SECONDS,
  };
}

/** Same flags as the real cookie with maxAge 0, so the browser matches and deletes it. */
export function clearedImpersonationCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ImpersonationCookieOptions {
  return { ...impersonationCookieOptions(nodeEnv), maxAge: 0 };
}

/** sha256 hex of a raw token. The database only ever stores this, never the token. */
export function hashImpersonationToken(token: string): string {
  return hashToken(token);
}

/**
 * Make a new random impersonation token.
 *
 * @returns `token` (goes in the cookie, shown once) and `tokenHash` (the only thing stored)
 */
export function generateImpersonationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashImpersonationToken(token) };
}

/**
 * True only for a value shaped exactly like a token we generate.
 * Why: a garbage cookie should never cause a database read.
 */
export function isPlausibleToken(value: string | null | undefined): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/**
 * Remove control characters and half-surrogates so the text is always safe to store or to send
 * to the database (a NUL byte makes PostgreSQL reject the whole statement).
 */
export function stripUnsafeChars(value: string, keepWhitespace = false): string {
  return value
    .replace(keepWhitespace ? CONTROL_CHARS_KEEP_WHITESPACE : CONTROL_CHARS, "")
    .replace(LONE_SURROGATE, "");
}

export type ReasonResult = { ok: true; value: string } | { ok: false; message: string };

/**
 * Clean and validate the "why are you viewing this account" text.
 *
 * @param raw untrusted input
 * @returns the trimmed reason, or a message that is safe to show the user
 */
export function validateReason(raw: unknown): ReasonResult {
  if (typeof raw !== "string") return { ok: false, message: "A reason is required." };
  const value = stripUnsafeChars(raw, true).trim();
  if (value.length < REASON_MIN_LENGTH) {
    return { ok: false, message: `Reason must be at least ${REASON_MIN_LENGTH} characters.` };
  }
  if (value.length > REASON_MAX_LENGTH) {
    return { ok: false, message: `Reason must be at most ${REASON_MAX_LENGTH} characters.` };
  }
  return { ok: true, value };
}

/**
 * May `actor` view-as `target`?
 *
 * Rules: the target exists, is active, is not a super-admin (no chained or lateral power),
 * is not the actor themself, has a known role (an unknown role has no portal) and belongs
 * to a school (the rest of the API scopes every query by school).
 */
export function isEligibleTarget(
  actor: { id: string },
  target: Pick<ImpersonationTarget, "id" | "role" | "status" | "school_id"> | null | undefined,
): boolean {
  if (!target) return false;
  if (target.id.toLowerCase() === actor.id.toLowerCase()) return false;
  if (target.status !== "active") return false;
  if (target.role === null || target.role === "super-admin") return false;
  if (!(ROLES as readonly string[]).includes(target.role)) return false;
  if (typeof target.school_id !== "string" || target.school_id.length === 0) return false;
  return true;
}

/**
 * First hop of an x-forwarded-for value, only if it is a real IP address.
 *
 * Why: audit_logs.ip_address is a Postgres `inet` column. Any other text (or an IPv6 zone
 * like "fe80::1%eth0") fails the INSERT, and because the audit write is fail-closed that
 * would answer every impersonated request with a 500. NOTE: the first hop is supplied by the
 * client on many proxies, so this address is informational, not proof of origin.
 *
 * @returns the address, or null when missing or not a valid IPv4/IPv6 literal
 */
export function sanitizeIp(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const first = raw.split(",")[0].trim();
  if (first.length === 0 || first.length > IP_MAX_LENGTH) return null;
  // Whitelist first: isIP() alone accepts "%zone" suffixes that inet rejects.
  if (!/^[0-9a-fA-F:.]+$/.test(first)) return null;
  return isIP(first) !== 0 ? first : null;
}

/** User-Agent header, cleaned and cut to USER_AGENT_MAX_LENGTH; null when empty. */
export function sanitizeUserAgent(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  // Cut first, clean after: cutting can split an emoji, and cleaning removes the half.
  const value = stripUnsafeChars(raw.slice(0, USER_AGENT_MAX_LENGTH)).trim();
  return value.length > 0 ? value : null;
}

/**
 * The path of a URL WITHOUT its query string (query strings can carry tokens or personal data).
 * Accepts absolute URLs and relative paths; returns null when it cannot be parsed.
 */
export function pathnameOnly(url: string): string | null {
  try {
    const pathname = new URL(url, "http://localhost").pathname;
    return stripUnsafeChars(pathname).slice(0, PATH_MAX_LENGTH);
  } catch {
    return null;
  }
}

/**
 * CSRF guard for the start/stop routes.
 *
 * If the browser sent an Origin header it must be OUR origin. A request with no Origin (curl,
 * server-to-server) is allowed here; the session cookie's sameSite=lax already stops the
 * browser attaching cookies to cross-site POSTs.
 */
export function sameOriginOk(req: Pick<Request, "url" | "headers">): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

/** Everything the audit log records about the HTTP request itself, already sanitised. */
export function describeRequest(req: Pick<Request, "url" | "headers">): {
  ip: string | null;
  userAgent: string | null;
  path: string | null;
} {
  return {
    ip: sanitizeIp(req.headers.get("x-forwarded-for")),
    userAgent: sanitizeUserAgent(req.headers.get("user-agent")),
    path: pathnameOnly(req.url),
  };
}

/**
 * True when a database error means "the schema is not installed / is behind" (migrations not run).
 *
 * Prisma codes: P2021 = table does not exist, P2022 = column does not exist, P2010 with
 * meta.code 42P01 = a raw query hit a missing relation. 42P01 is the PostgreSQL SQLSTATE itself.
 * Why it matters: on a fresh server (or after moving to your own PostgreSQL) the developer sees
 * "run the migrations" instead of a generic 500.
 */
export function isMissingTableError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, meta } = err as { code?: unknown; meta?: { code?: unknown } | null };
  if (code === "P2021" || code === "P2022" || code === "42P01") return true;
  return code === "P2010" && meta?.code === "42P01";
}

/**
 * A short, secret-free description of an error, safe to write to logs: the class name and, for
 * database errors, the code (for example "PrismaClientKnownRequestError P2002").
 *
 * Why it exists: a Prisma error MESSAGE can echo the query arguments (token hashes, reasons,
 * addresses), so messages are never logged. This is the only thing our logs say about a failure.
 */
export function safeErrorLabel(err: unknown): string {
  if (typeof err !== "object" || err === null) return "non-object error";
  const name = typeof (err as { name?: unknown }).name === "string" ? (err as { name: string }).name : "Error";
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code) ? `${name} ${code}` : name;
}

/** 503 that tells the developer exactly how to fix a missing-table problem. */
export function tablesNotInstalled(message: string = TABLES_MISSING_MESSAGE): ApiError {
  return new ApiError(503, message, { code: "SERVICE_UNAVAILABLE" });
}

const warnedKinds = new Set<string>();

/** console.warn once per failure kind per process, so a broken table cannot flood the logs. */
export function warnOnce(kind: string, detail?: string): void {
  if (warnedKinds.has(kind)) return;
  warnedKinds.add(kind);
  console.warn(`[impersonation] ${kind}${detail ? `: ${detail}` : ""}`);
}

/** Test seam: forget which warnings were already shown. */
export function __resetWarnedForTests(): void {
  warnedKinds.clear();
}

/**
 * Run an audit write and turn ANY failure into a 500 (FAIL CLOSED).
 *
 * Why it exists: while a super-admin acts as someone else, an action that cannot be recorded
 * must not happen. requireAuth calls this BEFORE the route handler runs, so a failed audit
 * write stops the request instead of letting it through unrecorded.
 *
 * @param writer performs the audit insert and rejects when it fails
 * @throws ApiError(500, "Audit log unavailable") when the writer rejects
 */
export async function enforceAudit(writer: () => Promise<void>): Promise<void> {
  try {
    await writer();
  } catch (err) {
    // Label only (class + code): a Prisma message can echo the arguments, which include the request's IP and UA.
    console.error("[audit] write failed, refusing the request:", safeErrorLabel(err));
    throw new ApiError(500, AUDIT_UNAVAILABLE_MESSAGE, { code: "AUDIT_UNAVAILABLE" });
  }
}

// =============================================================================
// Section 2 — the decision: is this request acting as the target?
// =============================================================================

export type SkipReason =
  | "no-cookie"
  | "not-super-admin"
  | "malformed-cookie"
  | "no-active-row"
  | "token-mismatch"
  | "row-ended"
  | "row-expired"
  | "actor-mismatch"
  | "session-mismatch"
  | "target-missing"
  | "target-mismatch"
  | "target-ineligible";

export type ImpersonationDecision = { mode: "target" } | { mode: "actor"; reason: SkipReason };

// The two "nothing is wrong" reasons stay silent; every other skip is a warning-worthy oddity.
const SILENT_SKIPS: ReadonlySet<SkipReason> = new Set<SkipReason>(["no-cookie", "not-super-admin"]);

export type DecideInput = {
  /** The REAL signed-in user (never the target). */
  actor: { userId: string; role: string; sessionId: string | undefined };
  cookiePresent: boolean;
  /** sha256 of the cookie value, or null when the cookie is absent or malformed. */
  cookieHash: string | null;
  row: ImpersonationRow | null;
  target: ImpersonationTarget | null;
  now: Date;
};

/**
 * The rulebook. Returns "target" ONLY when every single check passes; otherwise "actor"
 * plus the first reason that failed. Pure, so the check script can walk every branch.
 *
 * Order matters: the role check comes before anything about the row, so an ordinary user
 * holding a stray cookie is rejected without any table being consulted.
 */
export function decideImpersonation(input: DecideInput): ImpersonationDecision {
  const { actor, cookiePresent, cookieHash, row, target, now } = input;
  const skip = (reason: SkipReason): ImpersonationDecision => ({ mode: "actor", reason });

  if (!cookiePresent) return skip("no-cookie");
  if (actor.role !== "super-admin") return skip("not-super-admin");
  if (cookieHash === null) return skip("malformed-cookie");
  if (row === null) return skip("no-active-row");
  if (row.token_hash !== cookieHash) return skip("token-mismatch");
  if (row.ended_at !== null) return skip("row-ended");

  // An unparsable date is treated as expired: when in doubt, do not grant access.
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return skip("row-expired");

  if (row.actor_user_id !== actor.userId) return skip("actor-mismatch");
  // The row is welded to the actor's CURRENT login session: a new login needs a new impersonation.
  if (!actor.sessionId || row.actor_session_id !== actor.sessionId) return skip("session-mismatch");

  if (target === null) return skip("target-missing");
  if (target.id !== row.target_user_id) return skip("target-mismatch");
  if (!isEligibleTarget({ id: actor.userId }, target)) return skip("target-ineligible");

  return { mode: "target" };
}

/** The role/school/user the request should act as while impersonating. */
export type ImpersonatedIdentity = {
  userId: string;
  schoolId: string;
  schoolCode: string;
  role: Role;
};

/** Who is really behind the request, shown in the banner and written to the audit log. */
export type ImpersonatedBy = {
  id: string;
  name: string;
  role: Role;
  reason: string;
  expiresAt: string;
  sessionRowId: string;
};

export type ResolvedImpersonation = { identity: ImpersonatedIdentity; impersonatedBy: ImpersonatedBy };

/** The two database reads resolveImpersonation needs; injectable so tests can use stubs. */
export type ImpersonationDeps = {
  findActive(params: FindActiveParams): Promise<ImpersonationRow | null>;
  loadTarget(userId: string): Promise<ImpersonationTarget | null>;
};

export type RealActor = {
  userId: string;
  /** Role of the REAL signed-in user. Checked before any table is read. */
  role: string;
  /** user_sessions.id of the actor's real session. */
  sessionId: string | undefined;
  /** Display name for the banner. */
  name: string;
};

function defaultDeps(): ImpersonationDeps {
  return { findActive: findActiveImpersonation, loadTarget: loadImpersonationTarget };
}

/**
 * Work out whether this request should act as an impersonation target.
 *
 * What it does: role gate first, then read the impersonation row and the target, then run
 * decideImpersonation. Returns the target identity + actor info, or null.
 *
 * Why it exists: resolveSession() calls this for every request that carries the impersonation
 * cookie. NEVER THROWS: any error (missing table, network, bad data) returns null, which the
 * caller turns into "you are still yourself".
 *
 * @param actor      the real signed-in user
 * @param rawCookie  raw value of the stackable_impersonation cookie (undefined = no cookie)
 * @param deps       database reads (defaults to the Prisma ones in the repository)
 * @param now        clock, injectable for tests
 * @returns the identity to act as, or null for "not impersonating"
 */
export async function resolveImpersonation(
  actor: RealActor,
  rawCookie: string | undefined,
  deps: ImpersonationDeps = defaultDeps(),
  now: Date = new Date(),
): Promise<ResolvedImpersonation | null> {
  // Cheap exits first: no cookie, or not a super-admin, means NO table is touched.
  if (!rawCookie) return null;
  if (actor.role !== "super-admin") return null;

  try {
    const cookieHash = isPlausibleToken(rawCookie) ? hashImpersonationToken(rawCookie) : null;

    let row: ImpersonationRow | null = null;
    let target: ImpersonationTarget | null = null;
    if (cookieHash !== null && actor.sessionId) {
      row = await deps.findActive({
        tokenHash: cookieHash,
        actorUserId: actor.userId,
        actorSessionId: actor.sessionId,
        now,
      });
      if (row) target = await deps.loadTarget(row.target_user_id);
    }

    const decision = decideImpersonation({
      actor: { userId: actor.userId, role: actor.role, sessionId: actor.sessionId },
      cookiePresent: true,
      cookieHash,
      row,
      target,
      now,
    });

    if (decision.mode !== "target" || row === null || target === null) {
      if (decision.mode === "actor" && !SILENT_SKIPS.has(decision.reason)) {
        warnOnce(`skipped (${decision.reason})`);
      }
      return null;
    }

    return {
      identity: {
        userId: target.id,
        schoolId: target.school_id ?? "",
        schoolCode: target.school_code ?? "",
        role: target.role as Role,
      },
      impersonatedBy: {
        id: actor.userId,
        name: actor.name,
        role: "super-admin",
        reason: row.reason,
        expiresAt: new Date(row.expires_at).toISOString(),
        sessionRowId: row.id,
      },
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      warnOnce("tables missing (run the database migrations)");
    } else {
      warnOnce("lookup failed", safeErrorLabel(err));
    }
    return null; // fail safe: the request stays the real user
  }
}

// =============================================================================
// Section 3 — database access
// =============================================================================
// findActiveImpersonation, loadImpersonationTarget, createImpersonation,
// endImpersonation and writeAuditLog are re-exported from
// lib/repositories/impersonation.repo.ts (see the top of this file). They are
// the ONLY code that touches the database for this feature.
