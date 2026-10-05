// Developer console handlers: platform overview, schools, users and audit log (read-only in the demo).
import type { AdminUser } from "@/hooks/useAdminUsers";
import type { SchoolDetails } from "@/hooks/useSchools";
import type { DevAuditRow, DevOverview, DevPage, DevSchoolRow, DevUserRow } from "@/lib/dev-types";
import { route, type DemoRequest } from "../router";
import { SCHOOL, table } from "./data";

const UNAVAILABLE = { status: 400, body: { error: "Impersonation is not available in the demo.", code: "DEMO_UNAVAILABLE" } };
const ACTORS = [
  { id: "usr-901", name: "Sam Platform", role: "super-admin" },
  { id: "usr-001", name: "Grace Wanjiru", role: "admin" },
  { id: "usr-004", name: "Zawadi Hassan", role: "student" },
];
const ACTIONS = ["auth.login", "impersonation.start", "impersonation.stop", "school.update", "user.create", "auth.login"];

export function seedAudit(): DevAuditRow[] {
  return Array.from({ length: 30 }, (_, k) => {
    const action = ACTIONS[k % ACTIONS.length];
    const imp = action.startsWith("impersonation");
    return {
      id: `aud-${String(k + 1).padStart(3, "0")}`,
      createdAt: new Date(Date.UTC(2026, 8, 20, 8 + k, 0, 0)).toISOString(),
      action,
      method: "POST",
      path: imp ? `/api/dev/${action.replace(".", "/")}` : "/api/auth/login",
      actor: imp ? ACTORS[0] : ACTORS[(k % 2) + 1],
      target: imp ? ACTORS[2] : null,
      schoolId: SCHOOL.id,
      schoolName: SCHOOL.name,
      ipAddress: `197.232.0.${10 + k}`,
      userAgent: "Mozilla/5.0 (demo)",
      metadata: imp ? { reason: "Support request from the school", targetRole: "student" } : {},
    };
  });
}

/** Slice a filtered list into the page the UI asked for (1-based, default 20 per page, max 100). */
function paged<T>(url: URL, rows: T[]): DevPage<T> {
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}

const matches = (text: string, q: string | null) => !q || text.toLowerCase().includes(q.trim().toLowerCase());

function devUsers(db: DemoRequest["db"]): DevUserRow[] {
  const schools = table<SchoolDetails>(db, "schools");
  return table<AdminUser>(db, "users").map((u) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    role: u.role,
    status: u.status,
    schoolId: u.school_id,
    schoolName: schools.find((s) => s.id === u.school_id)?.name ?? null,
    schoolCode: u.school_code,
    createdAt: u.created_at,
  }));
}

function overview(db: DemoRequest["db"]): DevOverview {
  const users = devUsers(db);
  const count = (key: "role" | "status") =>
    users.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u[key]]: (acc[u[key]] ?? 0) + 1 }), {});
  const svc = (key: DevOverview["services"][number]["key"], label: string, latencyMs: number | null) => ({
    key, label, status: latencyMs === null ? ("dormant" as const) : ("ok" as const), configured: latencyMs !== null, latencyMs,
  });
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      schools: table(db, "schools").length,
      users: users.length,
      usersByRole: count("role"),
      usersByStatus: count("status"),
      activeSessions: 7,
      auditEvents24h: table(db, "audit").length,
      otpsIssued24h: 12,
    },
    services: [svc("database", "Database (PostgreSQL)", 18), svc("redis", "Redis", 6), svc("qstash", "QStash", null), svc("email", "Email (Resend)", null), svc("storage", "Storage", null)],
    platform: { appVersion: "demo", dataBackend: "prisma", authProvider: "demo", nodeEnv: "demo", redisConfigured: true, qstashConfigured: false },
  };
}

export function registerDev(): void {
  route("GET", "/api/dev/overview", ({ db }) => ({ ok: true, data: overview(db) }));

  route("GET", "/api/dev/schools", ({ db, url }) => {
    const users = devUsers(db);
    const rows: DevSchoolRow[] = table<SchoolDetails>(db, "schools")
      .filter((s) => matches(`${s.name} ${s.code}`, url.searchParams.get("q")))
      .map((s) => ({
        id: s.id, name: s.name, code: s.code, status: s.status, location: s.location ?? null, email: s.email,
        subscriptionPackage: s.subscription_package, subscriptionStatus: s.subscription_status, createdAt: s.subscription_started_at ?? "",
        userCount: Math.max(s.no_of_users, users.filter((u) => u.schoolId === s.id).length), studentCount: s.no_of_students,
      }));
    return { ok: true, data: paged(url, rows) };
  });

  route("GET", "/api/dev/users", ({ db, url }) => {
    const p = url.searchParams;
    const rows = devUsers(db).filter(
      (u) =>
        matches(`${u.firstName} ${u.lastName} ${u.email ?? ""}`, p.get("q")) &&
        (!p.get("role") || u.role === p.get("role")) &&
        (!p.get("schoolId") || u.schoolId === p.get("schoolId")) &&
        (!p.get("status") || u.status === p.get("status")),
    );
    return { ok: true, data: paged(url, rows) };
  });

  route("GET", "/api/dev/audit", ({ db, url }) => {
    const p = url.searchParams;
    const from = p.get("from");
    const to = p.get("to");
    const rows = table<DevAuditRow>(db, "audit")
      .filter(
        (a) =>
          (!p.get("actor") || a.actor.id === p.get("actor")) &&
          (!p.get("target") || a.target?.id === p.get("target")) &&
          (!p.get("action") || a.action.startsWith(p.get("action") ?? "")) &&
          (!from || a.createdAt.slice(0, 10) >= from) &&
          (!to || a.createdAt.slice(0, 10) <= to),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: true, data: paged(url, rows) };
  });

  route("POST", "/api/dev/impersonate/start", () => UNAVAILABLE);
  route("POST", "/api/dev/impersonate/stop", () => UNAVAILABLE);
}
