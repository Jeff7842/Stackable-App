// =============================================================================
// Developer console — server side (everything app/api/dev/** needs).
// -----------------------------------------------------------------------------
// Route files stay thin (auth, parse, respond); the real work is here:
//   * requireDevAuth        real super-admin only, never while impersonating
//   * query parsing         strict zod schemas + a search-text cleaner
//   * getDevOverview        counts + service health (cached 30 s)
//   * listDevSchools/Users/Audit   paginated, no credential columns
//   * startImpersonation / stopImpersonation   the security-critical flows
//
// Data comes from PostgreSQL through Prisma repositories (lib/repositories/
// dev-console.repo.ts and impersonation.repo.ts): this file never touches the
// database directly. The response TYPES are the contract in lib/dev-types.ts; they
// are re-exported below so both import paths work.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import pkg from "../package.json";
import { ApiError, badRequest, forbidden, notFound, toErrorResponse, unauthorized } from "@/lib/api/errors";
import {
  maybeRateLimit,
  requireAuth,
  resolveRealSession,
  type AuthContext,
} from "@/lib/api/guard";
import {
  AUDIT_ACTION_START,
  AUDIT_ACTION_STOP,
  IMPERSONATION_TTL_SECONDS,
  createImpersonation,
  describeRequest,
  endImpersonation,
  enforceAudit,
  findActiveImpersonation,
  generateImpersonationToken,
  hashImpersonationToken,
  isEligibleTarget,
  isMissingTableError,
  isPlausibleToken,
  loadImpersonationTarget,
  safeErrorLabel,
  sameOriginOk,
  stripUnsafeChars,
  tablesNotInstalled,
  validateReason,
  warnOnce,
  writeAuditLog,
} from "@/lib/api/impersonation";
import { parse } from "@/lib/api/validate";
import { getRedis } from "@/lib/api/redis";
import { cached } from "@/lib/cache";
import {
  countAuditSince,
  countLiveSessions,
  countOtpsSince,
  countSchools,
  countUsers,
  countUsersByRole,
  countUsersByStatus,
  findSchoolNames,
  findUserBriefs,
  listAuditPage,
  listSchoolsPage,
  listUsersPage,
  pingDatabase,
} from "@/lib/repositories/dev-console.repo";
import { ROLES, ROLE_HOME, USER_STATUSES, type Role } from "@/lib/validation/shared";
import type {
  DevAuditActor,
  DevAuditRow,
  DevOverview,
  DevPage,
  DevSchoolRow,
  DevServiceHealth,
  DevServiceKey,
  DevUserRow,
} from "./dev-types";

// The contract: `import type { DevOverview } from "@/lib/dev-server"` works as well as dev-types.
export type * from "./dev-types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUDIT_TABLES_MISSING_MESSAGE =
  "Audit tables are not installed. Run the database migrations (pnpm db:deploy).";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 100_000; // 100k pages x 100 rows: far beyond real data, but still a hard ceiling
const SEARCH_MAX_LENGTH = 80; // longer search terms are never useful and only cost the database
const MAX_SEARCH_TOKENS = 4; // "first last" plus a couple of extra words is plenty
const PROBE_TIMEOUT_MS = 2500; // one slow service must not stall the whole overview
const OVERVIEW_TTL_SECONDS = 30; // health page: fresh enough, cheap enough
const HOURS_24_MS = 24 * 60 * 60 * 1000;
const APP_VERSION = typeof pkg.version === "string" ? pkg.version : "unknown";

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ─── Auth + responses ─────────────────────────────────────────────────────────

/**
 * Gate for every developer-console data route.
 *
 * What it does: signed in, role super-admin, read rate limit, and NEVER while viewing as
 * someone else (a super-admin who is impersonating a teacher must not reach dev data).
 *
 * @throws ApiError 401 / 403 / 429
 */
export async function requireDevAuth(req: Request): Promise<AuthContext> {
  const ctx = await requireAuth(req, { roles: ["super-admin"], rateLimit: "read", denyImpersonation: true });
  // Belt and braces: requireAuth already refuses this, but the dev console must never depend on one check.
  if (ctx.impersonatedBy) throw forbidden("The developer console is not available while viewing as another user.");
  return ctx;
}

/** Real super-admin (impersonation NOT applied), same limiter as requireAuth. For start/stop. */
export async function requireRealSuperAdmin(): Promise<AuthContext> {
  const actor = await resolveRealSession();
  if (!actor) throw unauthorized();
  if (actor.role !== "super-admin") throw forbidden("Your role can't perform this action.");
  await maybeRateLimit("mutation", actor.userId);
  return actor;
}

/** `{ ok: true, data }` with no-store, the envelope every dev GET uses. */
export function devJson<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
}

/** Error response (via toErrorResponse) that is never cached. */
export function devError(err: unknown): NextResponse {
  const res = toErrorResponse(err);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Like devError, but a missing impersonation/audit table becomes the clear 503 message. */
export function impersonationError(err: unknown): NextResponse {
  if (isMissingTableError(err)) return devError(tablesNotInstalled());
  return devError(err);
}

// ─── Query parsing ────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

// Whole numbers only. Out-of-range values are clamped (page=0 -> 1, pageSize=500 -> 100);
// anything that is not a number is a 400.
const digits = z.string().regex(/^\d{1,6}$/, "Must be a whole number.");
const pageField = digits.transform((n) => clamp(Number(n), 1, MAX_PAGE));
const pageSizeField = digits.transform((n) => clamp(Number(n), 1, MAX_PAGE_SIZE));
const searchField = z.string().max(200, "Search text is too long.");
const idField = z.guid("Must be a valid id.");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Turn `2026-09-26` or `2026-09-26T10:00:00Z` into an ISO instant.
 * A bare date is INCLUSIVE: as the start of a range it means 00:00:00.000Z, as the end
 * 23:59:59.999Z. Returns null for anything else (including impossible dates like 2026-02-31).
 */
export function parseDateBoundary(raw: string, edge: "start" | "end"): string | null {
  const value = raw.trim();
  if (DATE_ONLY.test(value)) {
    const iso = `${value}${edge === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"}`;
    const date = new Date(iso);
    // Round-trip check: "2026-02-31" must not silently become March.
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date.toISOString();
  }
  if (DATE_TIME.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

const dateField = (edge: "start" | "end") =>
  z
    .string()
    .refine((v) => parseDateBoundary(v, edge) !== null, "Must be an ISO date (YYYY-MM-DD) or date-time.")
    .transform((v) => parseDateBoundary(v, edge) as string);

export const schoolsQuerySchema = z.object({
  q: searchField.optional(),
  page: pageField.optional(),
  pageSize: pageSizeField.optional(),
});

export const usersQuerySchema = z.object({
  q: searchField.optional(),
  role: z.enum(ROLES).optional(),
  schoolId: idField.optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: pageField.optional(),
  pageSize: pageSizeField.optional(),
});

export const auditQuerySchema = z.object({
  actor: idField.optional(),
  target: idField.optional(),
  // A prefix such as "impersonation." Restricted to safe characters (400 otherwise).
  action: z
    .string()
    .regex(/^[A-Za-z0-9._:-]{1,64}$/, "Use letters, digits and . _ : - (max 64).")
    .optional(),
  from: dateField("start").optional(),
  to: dateField("end").optional(),
  page: pageField.optional(),
  pageSize: pageSizeField.optional(),
});

/**
 * Parse a request's query string with a strict schema (400 with the failing fields on garbage).
 * Empty values (`?q=`) count as "not provided"; unknown parameters are ignored.
 */
export function parseDevQuery<T>(schema: z.ZodType<T>, url: string): T {
  const raw: Record<string, string> = {};
  for (const [key, value] of new URL(url).searchParams) {
    if (value.trim() !== "") raw[key] = value;
  }
  return parse(schema, raw);
}

/**
 * Clean a free-text search box value.
 *
 * What it does: turns any run of whitespace into one space, removes control characters (a NUL
 * byte makes PostgreSQL reject the statement) and half-surrogates, and caps the length.
 * Why it is enough: the text reaches the database only as a bound parameter, and the
 * repository escapes LIKE wildcards (`%` `_` `\`) so what remains is matched literally.
 */
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = stripUnsafeChars(raw.replace(/\s+/g, " ")).trim();
  return stripUnsafeChars(cleaned.slice(0, SEARCH_MAX_LENGTH)).trim();
}

/** Split a cleaned term into words; each word must match (AND), so "jane doe" finds Jane Doe. */
export function searchTokens(term: string): string[] {
  return term.split(" ").filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
}

const fullName = (first: unknown, last: unknown): string | null =>
  [first, last].filter((part) => typeof part === "string" && part.trim() !== "").join(" ").trim() || null;

// ─── Overview ─────────────────────────────────────────────────────────────────

class ProbeTimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms} ms`);
    this.name = "ProbeTimeoutError";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number = PROBE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeoutError(ms)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** True when an env var holds a real value (not empty, not the .env.example placeholder). Never returns the value. */
function isEnvSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" && !value.startsWith("REPLACE_ME");
}

/** Run one health probe; any failure or timeout becomes status "down", never an exception. */
async function probeService(
  key: DevServiceKey,
  label: string,
  configured: boolean,
  run: () => Promise<unknown>,
): Promise<DevServiceHealth> {
  if (!configured) return { key, label, status: "dormant", configured: false, latencyMs: null };
  const startedAt = performance.now();
  try {
    await withTimeout(run());
    return { key, label, status: "ok", configured: true, latencyMs: Math.round(performance.now() - startedAt) };
  } catch (err) {
    // Class + code only: connection errors can carry host names or query text.
    console.warn(`[dev] ${key} probe failed: ${safeErrorLabel(err)}`);
    return { key, label, status: "down", configured: true, latencyMs: null };
  }
}

/** A service with no cheap probe: report whether its env is present. */
function configOnly(key: DevServiceKey, label: string, configured: boolean): DevServiceHealth {
  return { key, label, status: configured ? "configured" : "dormant", configured, latencyMs: null };
}

/** Every service except the database (which is probed after the counts, see buildOverview). */
async function probeOtherServices(): Promise<DevServiceHealth[]> {
  const redisConfigured = isEnvSet("UPSTASH_REDIS_REST_URL") && isEnvSet("UPSTASH_REDIS_REST_TOKEN");

  return Promise.all([
    probeService("redis", "Cache (Upstash Redis)", redisConfigured, async () => {
      await getRedis().ping();
    }),
    Promise.resolve(configOnly("qstash", "Queue (QStash)", isEnvSet("QSTASH_TOKEN"))),
    Promise.resolve(configOnly("email", "Email (Resend)", isEnvSet("RESEND_API_KEY"))),
    // R2 env names as defined in lib/env.ts. Nothing reads R2 yet, so this only says "keys are present".
    Promise.resolve(
      configOnly(
        "storage",
        "File storage (R2)",
        isEnvSet("R2_ENDPOINT") && isEnvSet("R2_ACCESS_KEY_ID") && isEnvSet("R2_SECRET_ACCESS_KEY"),
      ),
    ),
  ]);
}

async function buildOverview(): Promise<DevOverview> {
  const now = new Date();
  const since24h = new Date(now.getTime() - HOURS_24_MS);

  const [schools, users, activeSessions, auditEvents24h, otpsIssued24h, roleCounts, statusCounts, otherServices] =
    await Promise.all([
      countSchools(),
      countUsers(),
      countLiveSessions(now),
      // audit_logs exists only after the migrations; without it the count is simply 0.
      countAuditSince(since24h).catch((err: unknown) => {
        if (isMissingTableError(err)) return 0;
        throw err;
      }),
      countOtpsSince(since24h),
      countUsersByRole(),
      countUsersByStatus(),
      probeOtherServices(),
    ]);

  // Probed AFTER the counts: they have just opened (or woken) the connection, so the ping measures
  // a real round trip instead of a cold start, which on a sleeping serverless database can be seconds.
  const database = await probeService("database", "Database (PostgreSQL)", true, pingDatabase);

  const usersByRole: Record<string, number> = {};
  for (const role of ROLES) usersByRole[role] = roleCounts[role] ?? 0;
  const usersByStatus: Record<string, number> = {};
  for (const status of USER_STATUSES) usersByStatus[status] = statusCounts[status] ?? 0;

  return {
    generatedAt: now.toISOString(),
    counts: { schools, users, usersByRole, usersByStatus, activeSessions, auditEvents24h, otpsIssued24h },
    services: [database, ...otherServices],
    platform: {
      appVersion: APP_VERSION,
      dataBackend: "prisma", // the only backend left; kept in the payload for the Settings page
      authProvider: process.env.AUTH_PROVIDER ?? "legacy",
      nodeEnv: process.env.NODE_ENV ?? "development",
      redisConfigured: isEnvSet("UPSTASH_REDIS_REST_URL") && isEnvSet("UPSTASH_REDIS_REST_TOKEN"),
      qstashConfigured: isEnvSet("QSTASH_TOKEN"),
    },
  };
}

/**
 * Platform counts and service health for the developer overview page.
 *
 * Cached for 30 s (one shared entry: the data is platform-wide, not per school). Every
 * non-database service probe has its own 2.5 s timeout and cannot fail the request; a failing
 * COUNT query does (an honest 500 beats invented zeros).
 */
export function getDevOverview(): Promise<DevOverview> {
  return cached("platform", "dev-overview", OVERVIEW_TTL_SECONDS, buildOverview);
}

// ─── Schools ──────────────────────────────────────────────────────────────────

/** One page of schools with user and student counts. Search matches name, code and e-mail. */
export async function listDevSchools(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<DevPage<DevSchoolRow>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const { rows, total } = await listSchoolsPage({
    terms: searchTokens(sanitizeSearchTerm(params.q)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      location: row.location,
      email: row.email,
      subscriptionPackage: row.subscription_package,
      subscriptionStatus: row.subscription_status,
      createdAt: row.created_at,
      userCount: row.userCount,
      studentCount: row.studentCount,
    })),
    total,
    page,
    pageSize,
  };
}

// ─── Users ────────────────────────────────────────────────────────────────────

/** One page of users. Never selects password_hash or any credential column. */
export async function listDevUsers(params: {
  q?: string;
  role?: Role;
  schoolId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<DevPage<DevUserRow>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  // role / status / schoolId were validated by zod (enum / guid) before reaching here.
  const { rows, total } = await listUsersPage({
    role: params.role,
    status: params.status,
    schoolId: params.schoolId,
    terms: searchTokens(sanitizeSearchTerm(params.q)),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role as Role,
      status: row.status,
      schoolId: row.school_id,
      schoolName: row.schoolName,
      schoolCode: row.school_code,
      createdAt: row.created_at,
    })),
    total,
    page,
    pageSize,
  };
}

// ─── Audit log ────────────────────────────────────────────────────────────────

/**
 * One page of the audit log, newest first. `action` is a prefix. audit_logs has no foreign
 * keys, so actor / target / school names come from batched lookups (no joins).
 *
 * @throws ApiError 503 (AUDIT_TABLES_MISSING_MESSAGE) when the migrations have not been run
 */
export async function listDevAudit(params: {
  actor?: string;
  target?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<DevPage<DevAuditRow>> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  if (params.from && params.to && params.from > params.to) {
    throw badRequest("`from` must not be after `to`.");
  }

  let result;
  try {
    result = await listAuditPage({
      actor: params.actor,
      target: params.target,
      actionPrefix: params.action,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(params.to) : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  } catch (err) {
    if (isMissingTableError(err)) throw tablesNotInstalled(AUDIT_TABLES_MISSING_MESSAGE);
    throw err;
  }
  const { rows, total } = result;

  // Names are decoration: if a lookup fails the log is still shown, just without names.
  const userIds = Array.from(new Set(rows.flatMap((row) => [row.actor_user_id, row.target_user_id ?? ""]))).filter(Boolean);
  const schoolIds = Array.from(new Set(rows.map((row) => row.school_id ?? ""))).filter(Boolean);
  const [users, schools] = await Promise.all([
    findUserBriefs(userIds).catch((err: unknown) => {
      warnOnce("audit name lookup failed", safeErrorLabel(err));
      return [];
    }),
    findSchoolNames(schoolIds).catch((err: unknown) => {
      warnOnce("audit school lookup failed", safeErrorLabel(err));
      return [];
    }),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const schoolNameById = new Map(schools.map((school) => [school.id, school.name]));

  const toActor = (id: string): DevAuditActor => {
    const user = userById.get(id);
    return { id, name: user ? fullName(user.first_name, user.last_name) : null, role: user?.role ?? null };
  };

  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      action: row.action,
      method: row.method,
      path: row.path,
      actor: toActor(row.actor_user_id),
      target: row.target_user_id ? toActor(row.target_user_id) : null,
      schoolId: row.school_id,
      schoolName: row.school_id ? schoolNameById.get(row.school_id) ?? null : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata:
        typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
    })),
    total,
    page,
    pageSize,
  };
}

// ─── Impersonation: start / stop ──────────────────────────────────────────────

export const startBodySchema = z
  .object({
    targetUserId: idField,
    // The real 10-500 rule is validateReason(); this only bounds what we are willing to look at.
    reason: z.string().max(2000, "Reason is too long."),
  })
  .strict();

/**
 * Begin viewing as another user.
 *
 * What it does: refuses if this browser is already impersonating, checks the target is
 * eligible, then in ONE transaction ends this actor's older live rows and creates the new
 * row (only the token HASH is stored), then records `impersonation.start` in the audit log.
 *
 * FAIL CLOSED: if the audit write fails the new row is ended again and this throws, so the
 * caller never sets a cookie for a view that was not recorded.
 *
 * @param input.actor          the REAL super-admin (resolveRealSession, never the impersonated context)
 * @param input.existingCookie raw current impersonation cookie, if any
 * @returns the raw token (for the cookie; shown once) and where to send the browser
 * @throws ApiError 400/404/409/500/501, or a database error (the caller maps a missing table to 503)
 */
export async function startImpersonation(input: {
  actor: AuthContext;
  targetUserId: string;
  reason: string;
  existingCookie: string | undefined;
  request: Pick<Request, "url" | "headers">;
}): Promise<{ token: string; redirectTo: string }> {
  const { actor, targetUserId, existingCookie, request } = input;

  const reason = validateReason(input.reason);
  if (!reason.ok) throw badRequest(reason.message, { fields: { reason: reason.message } });

  // Impersonation is welded to the actor's own session row id (user_sessions.id, or
  // ba_session.id under Better Auth — guard.ts's resolveContext() sets this on both
  // paths). Defensive only: resolveRealSession() never returns a context without one.
  if (!actor.sessionId) {
    throw new ApiError(501, "Could not identify your current session.", {
      code: "IMPERSONATION_UNSUPPORTED",
    });
  }
  const actorSessionId = actor.sessionId;

  // Already viewing as someone in THIS browser: the developer must exit first (no chaining).
  if (isPlausibleToken(existingCookie)) {
    const active = await findActiveImpersonation({
      tokenHash: hashImpersonationToken(existingCookie),
      actorUserId: actor.userId,
      actorSessionId,
      now: new Date(),
    });
    if (active) {
      throw new ApiError(409, "You are already viewing as another user. Exit that view first.", {
        code: "IMPERSONATION_ACTIVE",
      });
    }
  }

  const target = await loadImpersonationTarget(targetUserId);
  // One generic answer for every ineligible case (missing, suspended, super-admin, self ...).
  if (!isEligibleTarget({ id: actor.userId }, target) || target === null) {
    throw notFound("That user is not available for viewing.");
  }

  const { token, tokenHash } = generateImpersonationToken();
  const meta = describeRequest(request);
  // Ends the actor's older live rows and inserts this one, atomically (one live view per developer).
  const created = await createImpersonation({
    actorUserId: actor.userId,
    actorSessionId,
    targetUserId: target.id,
    tokenHash,
    reason: reason.value,
    expiresAt: new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  try {
    await enforceAudit(() =>
      writeAuditLog({
        schoolId: target.school_id,
        actorUserId: actor.userId,
        targetUserId: target.id,
        action: AUDIT_ACTION_START,
        method: "POST",
        path: meta.path,
        metadata: { reason: reason.value, targetRole: target.role, impersonationSessionId: created.id },
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    );
  } catch (auditError) {
    // Not recorded means not allowed: kill the row we just made. Even if THIS fails the token
    // was never given to anyone, so the row cannot be used.
    await endImpersonation({ by: "id", id: created.id, actorUserId: actor.userId }).catch((err: unknown) => {
      console.error("[impersonation] could not end row after audit failure:", safeErrorLabel(err));
    });
    throw auditError;
  }

  return { token, redirectTo: ROLE_HOME[target.role as Role] };
}

/**
 * Stop viewing as another user (idempotent).
 *
 * What it does: ends the live row that belongs to the cookie's token and records
 * `impersonation.stop`. BEST EFFORT on purpose: an outage or a missing table must never
 * trap the developer inside someone else's account, so nothing here throws for those.
 * The caller clears the cookie regardless of what happens here.
 */
export async function stopImpersonation(input: {
  actor: AuthContext;
  cookieToken: string | undefined;
  request: Pick<Request, "url" | "headers">;
}): Promise<void> {
  const { actor, cookieToken, request } = input;
  if (!isPlausibleToken(cookieToken)) return;

  let ended: Array<{ id: string; target_user_id: string }>;
  try {
    ended = await endImpersonation({
      by: "token",
      tokenHash: hashImpersonationToken(cookieToken),
      actorUserId: actor.userId,
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      warnOnce("tables missing (run the database migrations)");
    } else {
      console.error("[impersonation] could not end row on stop:", safeErrorLabel(err));
    }
    return;
  }

  const meta = describeRequest(request);
  for (const row of ended) {
    try {
      const target = await loadImpersonationTarget(row.target_user_id).catch(() => null);
      await writeAuditLog({
        schoolId: target?.school_id ?? null,
        actorUserId: actor.userId,
        targetUserId: row.target_user_id,
        action: AUDIT_ACTION_STOP,
        method: "POST",
        path: meta.path,
        metadata: { impersonationSessionId: row.id },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch (err) {
      // Best effort: the row is already ended and the cookie is cleared.
      console.error("[audit] could not record impersonation.stop:", safeErrorLabel(err));
    }
  }
}

/** Same-origin gate shared by start and stop. */
export function assertSameOrigin(req: Pick<Request, "url" | "headers">): void {
  if (!sameOriginOk(req)) throw forbidden("Cross-origin requests are not allowed here.");
}
