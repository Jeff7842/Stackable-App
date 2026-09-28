// =============================================================================
// Developer-console response types — the CONTRACT between the dev API
// (app/api/dev/**, implemented in lib/dev-server.ts) and the dev UI
// (hooks/useDev*.ts, components/dev/**).
// -----------------------------------------------------------------------------
// TYPE-ONLY FILE: no imports of server code, safe to import from client hooks.
// lib/dev-server.ts re-exports everything here (`export type * from "./dev-types"`).
// Changing a shape here means updating BOTH lanes; the CTO owns this file for
// Wave 2A. All timestamps are ISO-8601 strings; nothing here is ever a secret.
//
// Envelope for every GET: { ok: true, data: <type below> }.
// Paginated lists use DevPage<T>.
// =============================================================================

import type { Role } from "@/lib/validation/shared";

export type DevPage<T> = {
  items: T[];
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
};

// ── GET /api/dev/overview ─────────────────────────────────────────────────────
export type DevServiceKey = "database" | "redis" | "qstash" | "email" | "storage";

/**
 * ok         reachable, latencyMs set (database, redis-if-configured)
 * down       configured/expected but the probe failed or timed out
 * dormant    not configured (Redis/QStash/Resend/R2 env missing) - not an error
 * configured env present but no cheap probe exists (qstash, email, storage)
 */
export type DevServiceStatus = "ok" | "down" | "dormant" | "configured";

export type DevServiceHealth = {
  key: DevServiceKey;
  /** Display label, e.g. "Database (PostgreSQL)". */
  label: string;
  status: DevServiceStatus;
  configured: boolean;
  /** Round-trip time of the probe in ms; null when there is no probe / not configured. */
  latencyMs: number | null;
};

export type DevOverview = {
  generatedAt: string;
  counts: {
    schools: number;
    users: number;
    /** Keyed by role, e.g. { teacher: 12, parent: 40 }. Roles with 0 users may be absent. */
    usersByRole: Record<string, number>;
    /** Keyed by status: active | suspended | pending. */
    usersByStatus: Record<string, number>;
    activeSessions: number;
    auditEvents24h: number;
    otpsIssued24h: number;
  };
  services: DevServiceHealth[];
  /** Non-secret platform facts for the read-only Settings page. */
  platform: {
    appVersion: string;
    dataBackend: string; // always "prisma" (PostgreSQL through Prisma)
    authProvider: string; // "legacy" | "betterauth"
    nodeEnv: string;
    redisConfigured: boolean;
    qstashConfigured: boolean;
  };
};

// ── GET /api/dev/schools?q=&page=&pageSize= ───────────────────────────────────
export type DevSchoolRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  location: string | null;
  email: string | null;
  subscriptionPackage: string;
  subscriptionStatus: string;
  createdAt: string;
  userCount: number;
  studentCount: number;
};

// ── GET /api/dev/users?q=&role=&schoolId=&status=&page=&pageSize= ────────────
export type DevUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: Role;
  status: string;
  schoolId: string;
  schoolName: string | null;
  schoolCode: string;
  createdAt: string;
};

// ── GET /api/dev/audit?actor=&target=&action=&from=&to=&page=&pageSize= ───────
// `actor` / `target` are user ids. `action` is a PREFIX ("impersonation." matches all
// impersonation events). `from` / `to` are ISO dates (inclusive).
export type DevAuditActor = { id: string; name: string | null; role: string | null };

export type DevAuditRow = {
  id: string;
  createdAt: string;
  /** "impersonation.start" | "impersonation.stop" | "impersonation.request" | ... */
  action: string;
  method: string | null;
  /** Pathname only; the query string is never stored. */
  path: string | null;
  actor: DevAuditActor;
  target: DevAuditActor | null;
  schoolId: string | null;
  schoolName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  /** Free-form (impersonation.start: { reason, targetRole }). */
  metadata: Record<string, unknown>;
};

// ── POST /api/dev/impersonate/start | stop ────────────────────────────────────
// Body of start: { targetUserId: uuid, reason: string (10-500 chars) }.
// Flat responses (NOT wrapped in `data`): { ok: true, redirectTo: string }.
export type ImpersonateStartBody = { targetUserId: string; reason: string };
export type ImpersonateResponse = { ok: true; redirectTo: string };
