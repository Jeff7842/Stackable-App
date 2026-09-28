// =============================================================================
// Developer-console repository — the read queries behind /api/dev/* (overview
// counts, database ping, and the paginated schools / users / audit lists), on
// Prisma + plain PostgreSQL.
// -----------------------------------------------------------------------------
// Rules this file keeps:
//   * Every list is bounded: `take` is always set by the caller (clamped to 1..100 upstream).
//   * Counts come from COUNT / GROUP BY in the database, never from fetching rows.
//   * Never selects password_hash or any credential column.
//   * Search text is passed to Prisma as a bound parameter, so it can never change the query's
//     structure. Prisma does NOT escape LIKE wildcards, though, so escapeLike() below makes
//     `%`, `_` and `\` in a search term match literally (verified against PostgreSQL).
//   * Results are JSON-safe: dates are ISO strings.
// Only repositories may import lib/db/prisma.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Make text match literally inside a LIKE pattern.
 *
 * Why: Prisma's `contains` / `startsWith` build `LIKE '%text%'` without escaping, so a `%` or `_`
 * typed by a user would act as a wildcard and a trailing `\` as a broken escape. PostgreSQL's
 * default LIKE escape character is the backslash, so prefixing those three characters fixes it.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// ── Health + overview counts ─────────────────────────────────────────────────

/** Cheapest possible round trip to the database (for the health probe). Rejects when unreachable. */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export const countSchools = (): Promise<number> => prisma.schools.count();

export const countUsers = (): Promise<number> => prisma.users.count();

/** Sessions that are not revoked and not expired. */
export const countLiveSessions = (now: Date): Promise<number> =>
  prisma.user_sessions.count({ where: { revoked_at: null, expires_at: { gt: now } } });

export const countAuditSince = (since: Date): Promise<number> =>
  prisma.audit_logs.count({ where: { created_at: { gte: since } } });

export const countOtpsSince = (since: Date): Promise<number> =>
  prisma.user_otps.count({ where: { created_at: { gte: since } } });

/** Users per role, as { role: count }. Roles with no users are simply absent. */
export async function countUsersByRole(): Promise<Record<string, number>> {
  const groups = await prisma.users.groupBy({ by: ["role"], _count: { _all: true } });
  return Object.fromEntries(groups.map((group) => [group.role, group._count._all]));
}

/** Users per status, as { status: count }. */
export async function countUsersByStatus(): Promise<Record<string, number>> {
  const groups = await prisma.users.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
}

// ── Schools ──────────────────────────────────────────────────────────────────

export type SchoolPageRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  location: string | null;
  email: string | null;
  subscription_package: string;
  subscription_status: string;
  created_at: string;
  userCount: number;
  studentCount: number;
};

/**
 * One page of schools with their user and student counts.
 *
 * @param terms search words; every word must match the name, code or e-mail (case-insensitive)
 * @param skip  rows to skip (offset)
 * @param take  page size (caller clamps to 1..100)
 */
export async function listSchoolsPage(params: {
  terms: string[];
  skip: number;
  take: number;
}): Promise<{ rows: SchoolPageRow[]; total: number }> {
  const where: Prisma.schoolsWhereInput = {
    AND: params.terms.map((term) => ({
      OR: [
        { name: { contains: escapeLike(term), mode: "insensitive" } },
        { code: { contains: escapeLike(term), mode: "insensitive" } },
        { email: { contains: escapeLike(term), mode: "insensitive" } },
      ],
    })),
  };

  const [schools, total] = await prisma.$transaction([
    prisma.schools.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        location: true,
        email: true,
        subscription_package: true,
        subscription_status: true,
        created_at: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.schools.count({ where }),
  ]);

  // Two grouped counts for the whole page (bounded by `ids`), not two queries per school.
  const ids = schools.map((school) => school.id);
  const [userGroups, studentGroups] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.users.groupBy({ by: ["school_id"], where: { school_id: { in: ids } }, _count: { _all: true } }),
          prisma.students.groupBy({ by: ["school_id"], where: { school_id: { in: ids } }, _count: { _all: true } }),
        ]);
  const userCounts = new Map(userGroups.map((group) => [group.school_id, group._count._all]));
  const studentCounts = new Map(studentGroups.map((group) => [group.school_id, group._count._all]));

  return {
    total,
    rows: schools.map((school) => ({
      ...school,
      created_at: school.created_at.toISOString(),
      userCount: userCounts.get(school.id) ?? 0,
      studentCount: studentCounts.get(school.id) ?? 0,
    })),
  };
}

// ── Users ────────────────────────────────────────────────────────────────────

export type UserPageRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  status: string;
  school_id: string;
  school_code: string;
  created_at: string;
  schoolName: string | null;
};

/**
 * One page of users, newest first, with their school's name.
 * Every filter is optional; `terms` words must each match first name, last name, e-mail or school code.
 */
export async function listUsersPage(params: {
  role?: string;
  status?: string;
  schoolId?: string;
  terms: string[];
  skip: number;
  take: number;
}): Promise<{ rows: UserPageRow[]; total: number }> {
  const where: Prisma.usersWhereInput = {
    role: params.role,
    status: params.status,
    school_id: params.schoolId,
    AND: params.terms.map((term) => ({
      OR: [
        { first_name: { contains: escapeLike(term), mode: "insensitive" } },
        { last_name: { contains: escapeLike(term), mode: "insensitive" } },
        { email: { contains: escapeLike(term), mode: "insensitive" } },
        { school_code: { contains: escapeLike(term), mode: "insensitive" } },
      ],
    })),
  };

  const [users, total] = await prisma.$transaction([
    prisma.users.findMany({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        status: true,
        school_id: true,
        school_code: true,
        created_at: true,
        schools: { select: { name: true } },
      },
      // The id tie-breaker keeps pages from overlapping when rows share a timestamp.
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.users.count({ where }),
  ]);

  return {
    total,
    rows: users.map(({ schools, created_at, ...user }) => ({
      ...user,
      created_at: created_at.toISOString(),
      schoolName: schools?.name ?? null,
    })),
  };
}

// ── Audit log ────────────────────────────────────────────────────────────────

export type AuditPageRow = {
  id: string;
  school_id: string | null;
  actor_user_id: string;
  target_user_id: string | null;
  action: string;
  method: string | null;
  path: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

/**
 * One page of audit_logs, newest first.
 *
 * @param actionPrefix  keep rows whose action STARTS WITH this text (already restricted to safe characters)
 * @param from / to     inclusive created_at bounds
 */
export async function listAuditPage(params: {
  actor?: string;
  target?: string;
  actionPrefix?: string;
  from?: Date;
  to?: Date;
  skip: number;
  take: number;
}): Promise<{ rows: AuditPageRow[]; total: number }> {
  const where: Prisma.audit_logsWhereInput = {
    actor_user_id: params.actor,
    target_user_id: params.target,
    action: params.actionPrefix ? { startsWith: escapeLike(params.actionPrefix) } : undefined,
    created_at: params.from || params.to ? { gte: params.from, lte: params.to } : undefined,
  };

  const [logs, total] = await prisma.$transaction([
    prisma.audit_logs.findMany({
      where,
      select: {
        id: true,
        school_id: true,
        actor_user_id: true,
        target_user_id: true,
        action: true,
        method: true,
        path: true,
        metadata: true,
        ip_address: true,
        user_agent: true,
        created_at: true,
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.audit_logs.count({ where }),
  ]);

  return { total, rows: logs.map((log) => ({ ...log, created_at: log.created_at.toISOString() })) };
}

export type UserBrief = { id: string; first_name: string; last_name: string; role: string };

/** Names and roles for a set of user ids (audit_logs has no foreign keys, so no joins). */
export function findUserBriefs(ids: string[]): Promise<UserBrief[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.users.findMany({
    where: { id: { in: ids } },
    select: { id: true, first_name: true, last_name: true, role: true },
  });
}

/** Names for a set of school ids. */
export function findSchoolNames(ids: string[]): Promise<Array<{ id: string; name: string }>> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.schools.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
}
