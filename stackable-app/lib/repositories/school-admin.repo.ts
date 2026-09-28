// =============================================================================
// School admin repository (Prisma + PostgreSQL) — everything /api/school/** needs.
// -----------------------------------------------------------------------------
// Replaces the old Supabase view `school_usage_overview` (it does not exist in this
// database): each school's capacity, package, dates, head/owner, phone, location and logo
// come from `schools` + `school_profiles`, and the per-role head-counts are ONE grouped
// query over `users` (never a query per school).
//
// Head-count buckets (users.role -> counter):
//   teacher -> no_of_teachers          student, pupil -> no_of_students
//   parent  -> no_of_parents           admin, manager -> no_of_admins
//   staff   -> no_of_staff             every user row of the school -> no_of_users
//
// JSON rules: BigInt -> number (phones -> string, as the UI reads them), Date -> ISO string.
// Multi-row writes run in one interactive transaction, and the audit row is written in that
// same transaction (see audit-log.repo.ts).
// Only repositories import lib/db/prisma.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ApiError, notFound } from "@/lib/api/errors";
import { toIso } from "@/lib/admin-normalize";
import { cached, bumpCache } from "@/lib/cache";
import { generateSchoolCode } from "@/lib/school-security";
import { MAX_CODE_CHANGES } from "@/lib/validation/school-admin";
import { insertAudit, type AuditContext } from "@/lib/repositories/audit-log.repo";

// cached()/bumpCache() are keyed by a tenant (schoolId). A super-admin's "every school"
// listing has no single tenant, so it lives in this fixed platform-wide bucket instead -
// bumped alongside the specific school whenever any one school changes.
const PLATFORM_CACHE_KEY = "platform";
const SCHOOLS_CACHE_TTL = 30;

async function bumpSchoolCaches(id: string): Promise<void> {
  await Promise.all([bumpCache(id, "schools"), bumpCache(PLATFORM_CACHE_KEY, "schools")]);
}

/* ----------------------------------------------------------------- limits --- */

/** A platform never lists more schools than this in one response (the page filters client-side). */
const MAX_SCHOOLS_LISTED = 1000;
/** Tries at finding a school code nobody has (4 random hex chars: collisions are rare). */
const CODE_ATTEMPTS = 10;
/** Regenerating a school code is a queued change that settles after two weeks (kept from the old route). */
const CODE_CHANGE_DELAY_MS = 14 * 24 * 60 * 60 * 1000;
/** "Increase capacity" adds these to the totals (same numbers as the old route). */
const CAPACITY_STEP = { users: 50, students: 10, parents: 10, teachers: 10, admins: 10, staff: 10 } as const;
/** school_profiles.location is NOT NULL and defaults to this placeholder. */
const EMPTY_LOCATION = "EMPTY";

/* ------------------------------------------------------------------ types --- */

/** One school as GET /api/school returns it (the old `school_usage_overview` row). */
export type SchoolOverview = {
  id: string;
  school_id: number;
  name: string;
  code: string;
  logo: string | null;
  email: string | null;
  phone_1: string | null;
  head_name: string | null;
  owner_name: string | null;
  status: string;
  subscription_package: string;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  expected_users: number;
  expected_teachers: number;
  expected_admins: number;
  expected_students: number;
  expected_parents: number;
  expected_staff: number;
  no_of_users: number;
  no_of_teachers: number;
  no_of_admins: number;
  no_of_students: number;
  no_of_parents: number;
  no_of_staff: number;
  code_change_count: number;
  pending_code_change_at: string | null;
  /** Always null: the column does not exist in this database (see the lane report). */
  pending_status_change_at: string | null;
};

/** GET /api/school/[id]: the overview row plus the extra profile fields the edit form needs. */
export type SchoolDetail = SchoolOverview & {
  phone_2: string | null;
  phone_3: string | null;
  location: string | null;
};

type Counts = {
  no_of_users: number;
  no_of_teachers: number;
  no_of_admins: number;
  no_of_students: number;
  no_of_parents: number;
  no_of_staff: number;
};

/** Columns of `schools` we read for the overview/detail, plus the 1:1 profile. */
const SCHOOL_SELECT = {
  id: true,
  school_id: true,
  name: true,
  code: true,
  logo: true,
  email: true,
  location: true,
  phone_1: true,
  phone_2: true,
  phone_3: true,
  status: true,
  subscription_package: true,
  subscription_status: true,
  subscription_started_at: true,
  subscription_expires_at: true,
  expected_users: true,
  expected_teachers: true,
  expected_admins: true,
  expected_students: true,
  expected_parents: true,
  expected_staff: true,
  code_change_count: true,
  pending_code_change_at: true,
  school_profiles: { select: { head_name: true, owner_name: true, location: true } },
} satisfies Prisma.schoolsSelect;

type SchoolRecord = Prisma.schoolsGetPayload<{ select: typeof SCHOOL_SELECT }>;

/* ---------------------------------------------------------------- mapping --- */

const EMPTY_COUNTS: Counts = {
  no_of_users: 0,
  no_of_teachers: 0,
  no_of_admins: 0,
  no_of_students: 0,
  no_of_parents: 0,
  no_of_staff: 0,
};

/** Which counter a role feeds, besides no_of_users. */
const ROLE_BUCKET: Record<string, keyof Counts | undefined> = {
  teacher: "no_of_teachers",
  student: "no_of_students",
  pupil: "no_of_students",
  parent: "no_of_parents",
  admin: "no_of_admins",
  manager: "no_of_admins",
  staff: "no_of_staff",
};

const bigToText = (value: bigint | null): string | null => (value === null ? null : value.toString());

/** code_change_count is a text column; anything unreadable counts as 0. */
function toCodeChangeCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** The profile row's location wins unless it is the NOT NULL placeholder, then the schools column. */
function pickLocation(school: SchoolRecord): string | null {
  const fromProfile = school.school_profiles?.location?.trim();
  if (fromProfile && fromProfile.toUpperCase() !== EMPTY_LOCATION) return fromProfile;
  return school.location ?? null;
}

function toOverview(school: SchoolRecord, counts: Counts): SchoolOverview {
  return {
    id: school.id,
    school_id: Number(school.school_id),
    name: school.name,
    code: school.code,
    logo: school.logo,
    email: school.email,
    phone_1: bigToText(school.phone_1),
    head_name: school.school_profiles?.head_name ?? null,
    owner_name: school.school_profiles?.owner_name ?? null,
    status: school.status,
    subscription_package: school.subscription_package,
    subscription_status: school.subscription_status,
    subscription_started_at: toIso(school.subscription_started_at),
    subscription_expires_at: toIso(school.subscription_expires_at),
    expected_users: school.expected_users,
    expected_teachers: school.expected_teachers,
    expected_admins: school.expected_admins,
    expected_students: school.expected_students,
    expected_parents: school.expected_parents,
    expected_staff: school.expected_staff,
    ...counts,
    code_change_count: toCodeChangeCount(school.code_change_count),
    pending_code_change_at: toIso(school.pending_code_change_at),
    pending_status_change_at: null,
  };
}

/** One grouped query: users per (school, role), folded into the six counters per school. */
async function loadCounts(schoolIds: string[]): Promise<Map<string, Counts>> {
  const result = new Map<string, Counts>();
  if (schoolIds.length === 0) return result;

  const groups = await prisma.users.groupBy({
    by: ["school_id", "role"],
    where: { school_id: { in: schoolIds } },
    _count: { _all: true },
  });

  for (const group of groups) {
    const counts = result.get(group.school_id) ?? { ...EMPTY_COUNTS };
    counts.no_of_users += group._count._all;
    const bucket = ROLE_BUCKET[group.role];
    if (bucket) counts[bucket] += group._count._all;
    result.set(group.school_id, counts);
  }
  return result;
}

/* ------------------------------------------------------------------ reads --- */

/**
 * Every school (or just `onlyId`), A-Z by name, with head-counts.
 *
 * @param opts.onlyId limit to one school (used for school admins, who only see their own)
 */
export async function listSchoolOverviews(opts: { onlyId?: string } = {}): Promise<SchoolOverview[]> {
  return cached(opts.onlyId ?? PLATFORM_CACHE_KEY, "schools-list", SCHOOLS_CACHE_TTL, async () => {
    const schools = await prisma.schools.findMany({
      where: opts.onlyId ? { id: opts.onlyId } : {},
      select: SCHOOL_SELECT,
      orderBy: { name: "asc" },
      take: MAX_SCHOOLS_LISTED,
    });
    const counts = await loadCounts(schools.map((school) => school.id));
    return schools.map((school) => toOverview(school, counts.get(school.id) ?? EMPTY_COUNTS));
  });
}

/** One school with its profile fields, or null when it does not exist. */
export async function findSchoolDetail(id: string): Promise<SchoolDetail | null> {
  return cached(id, "school-detail", SCHOOLS_CACHE_TTL, async () => {
    const school = await prisma.schools.findUnique({ where: { id }, select: SCHOOL_SELECT });
    if (!school) return null;
    const counts = await loadCounts([school.id]);
    return {
      ...toOverview(school, counts.get(school.id) ?? EMPTY_COUNTS),
      phone_2: bigToText(school.phone_2),
      phone_3: bigToText(school.phone_3),
      location: pickLocation(school),
    };
  });
}

/** The stored values of the fields only a super-admin may change, or null when the school is missing. */
export function findSchoolSensitiveFields(id: string) {
  return prisma.schools.findUnique({
    where: { id },
    select: {
      name: true,
      status: true,
      subscription_package: true,
      subscription_status: true,
      subscription_started_at: true,
      subscription_expires_at: true,
      expected_users: true,
      expected_students: true,
      expected_parents: true,
      expected_teachers: true,
      expected_admins: true,
      expected_staff: true,
    },
  });
}

/* --------------------------------------------------------------- db errors --- */

/** Prisma's error code (P2002 unique, P2003 foreign key), or null for anything else. */
function dbCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

const conflict = (message: string, code: string) => new ApiError(409, message, { code });

/* ------------------------------------------------------------------ create --- */

export type NewSchoolRecord = {
  /** Generated by the caller: the confirmation link is signed with it before the row exists. */
  id: string;
  name: string;
  email: string;
  phone_1: string;
  phone_2: string | null;
  phone_3: string | null;
  head_name: string | null;
  owner_name: string | null;
  location: string | null;
  logo: string | null;
  subscription_package: string;
  subscription_status: string;
  subscription_started_at: Date;
  subscription_expires_at: Date | null;
  expected_users: number;
  expected_students: number;
  expected_parents: number;
  expected_teachers: number;
  expected_admins: number;
  expected_staff: number;
};

/** Rows for school_security_codes (built by lib/school-security.ts buildSchoolSecurityCodeRows). */
export type SecurityCodeRow = {
  school_id: string;
  code_label: string;
  code_hash: string;
  is_active: boolean;
  used_count: number;
  last_used_at: null;
  created_by: string | null;
};

/**
 * A school code nobody has yet. Runs inside the caller's client so it sees the same data.
 * The unique constraint on `code` is the real guard; this only avoids most collisions.
 */
async function findFreeSchoolCode(client: Pick<Prisma.TransactionClient, "schools">, name: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = generateSchoolCode(name);
    const taken = await client.schools.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  throw new ApiError(503, "Could not generate a unique school code. Please try again.", { code: "SCHOOL_CODE_UNAVAILABLE" });
}

/**
 * Create a school, its profile and its five security codes in ONE transaction, with the audit row.
 * The human-facing school number is max + 1, allocated under an advisory lock so two creates at
 * the same moment cannot receive the same number.
 *
 * @returns the fields the create response needs
 * @throws 409 SCHOOL_NAME_TAKEN when the name (or generated code) is already used
 */
export async function createSchoolRecord(
  input: NewSchoolRecord,
  securityCodes: SecurityCodeRow[],
  audit: AuditContext,
): Promise<{ id: string; school_id: number; name: string; code: string; email: string; status: string }> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Constant lock key (7400231) that serialises "next school number" allocation; released at commit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7400231)`;
      const latest = await tx.schools.aggregate({ _max: { school_id: true } });
      const schoolNumber = (latest._max.school_id ?? BigInt(0)) + BigInt(1);
      const code = await findFreeSchoolCode(tx, input.name);
      const now = new Date();
      const location = input.location ?? null;

      await tx.schools.create({
        data: {
          id: input.id,
          school_id: schoolNumber,
          name: input.name,
          code,
          logo: input.logo,
          email: input.email,
          location,
          phone_1: BigInt(input.phone_1),
          phone_2: input.phone_2 === null ? null : BigInt(input.phone_2),
          phone_3: input.phone_3 === null ? null : BigInt(input.phone_3),
          status: "pending",
          subscription_package: input.subscription_package,
          subscription_status: input.subscription_status,
          subscription_started_at: input.subscription_started_at,
          subscription_expires_at: input.subscription_expires_at,
          expected_users: input.expected_users,
          expected_students: input.expected_students,
          expected_parents: input.expected_parents,
          expected_teachers: input.expected_teachers,
          expected_admins: input.expected_admins,
          expected_staff: input.expected_staff,
          updated_at: now,
          school_profiles: {
            create: {
              head_name: input.head_name,
              owner_name: input.owner_name,
              location: location ?? EMPTY_LOCATION,
              updated_at: now,
            },
          },
        },
        select: { id: true },
      });
      await tx.school_security_codes.createMany({ data: securityCodes });
      await insertAudit(tx, audit, {
        schoolId: input.id,
        action: "school.create",
        metadata: { name: input.name, subscription_package: input.subscription_package },
      });

      return { id: input.id, school_id: Number(schoolNumber), name: input.name, code, email: input.email, status: "pending" };
    });
    await bumpSchoolCaches(created.id);
    return created;
  } catch (err) {
    if (dbCode(err) === "P2002") {
      throw conflict("A school with this name already exists.", "SCHOOL_NAME_TAKEN");
    }
    throw err;
  }
}

/**
 * Undo a create whose confirmation email could not be sent: deleting the school cascades to its
 * profile and security codes. Best effort by design (the caller is already reporting a failure).
 */
export async function discardNewSchool(id: string, audit: AuditContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.schools.deleteMany({ where: { id } });
    await insertAudit(tx, audit, { schoolId: id, action: "school.create_rolled_back" });
  });
  await bumpSchoolCaches(id);
}

/* ------------------------------------------------------------------ update --- */

/** The columns of `schools` a PATCH may write (only the keys that are present are applied). */
export type SchoolUpdateData = {
  name?: string;
  email?: string | null;
  phone_1?: string;
  phone_2?: string | null;
  phone_3?: string | null;
  logo?: string | null;
  status?: string;
  subscription_package?: string;
  subscription_status?: string;
  subscription_started_at?: Date | null;
  subscription_expires_at?: Date | null;
  expected_users?: number;
  expected_students?: number;
  expected_parents?: number;
  expected_teachers?: number;
  expected_admins?: number;
  expected_staff?: number;
};

/** The profile fields a PATCH may write; a key that is present (even null) is applied. */
export type SchoolProfileUpdate = { head_name?: string | null; owner_name?: string | null; location?: string | null };

const optionalBigInt = (value: string | null | undefined): bigint | null | undefined =>
  value === undefined ? undefined : value === null ? null : BigInt(value);

/**
 * Save an edit: the schools row, and the profile row when head / owner / location came along,
 * in one transaction together with the audit row.
 *
 * @param auditMeta small JSON facts for the audit row (changed field names, before/after of sensitive ones)
 * @throws 404 when the school does not exist; 409 when the name is taken or still referenced by students / parents
 */
export async function updateSchoolRecord(
  id: string,
  data: SchoolUpdateData,
  profile: SchoolProfileUpdate,
  audit: AuditContext,
  auditMeta: Record<string, unknown>,
): Promise<void> {
  const now = new Date();
  const hasProfile = Object.values(profile).some((value) => value !== undefined);
  try {
    await prisma.$transaction(async (tx) => {
      const { phone_1, phone_2, phone_3, ...plain } = data;
      const { count } = await tx.schools.updateMany({
        where: { id },
        data: {
          ...plain,
          ...(phone_1 !== undefined ? { phone_1: BigInt(phone_1) } : {}),
          ...(phone_2 !== undefined ? { phone_2: optionalBigInt(phone_2) } : {}),
          ...(phone_3 !== undefined ? { phone_3: optionalBigInt(phone_3) } : {}),
          // keep the schools.location column in step with the profile (other readers use it)
          ...(profile.location !== undefined ? { location: profile.location } : {}),
          updated_at: now,
        },
      });
      if (count === 0) throw notFound("School not found.");

      if (hasProfile) {
        await tx.school_profiles.upsert({
          where: { school_id: id },
          create: {
            school_id: id,
            head_name: profile.head_name ?? null,
            owner_name: profile.owner_name ?? null,
            location: profile.location ?? EMPTY_LOCATION,
            updated_at: now,
          },
          update: {
            ...(profile.head_name !== undefined ? { head_name: profile.head_name } : {}),
            ...(profile.owner_name !== undefined ? { owner_name: profile.owner_name } : {}),
            ...(profile.location !== undefined ? { location: profile.location ?? EMPTY_LOCATION } : {}),
            updated_at: now,
          },
        });
      }
      await insertAudit(tx, audit, { schoolId: id, action: "school.update", metadata: auditMeta });
    });
    await bumpSchoolCaches(id);
  } catch (err) {
    const code = dbCode(err);
    if (code === "P2002") throw conflict("A school with this name already exists.", "SCHOOL_NAME_TAKEN");
    if (code === "P2003") {
      throw conflict(
        "This school already has students or parents recorded under its current name, so it cannot be renamed here.",
        "SCHOOL_NAME_IN_USE",
      );
    }
    throw err;
  }
}

/* ----------------------------------------------------------------- actions --- */

/**
 * Set the school's status (activate / suspend) and record who did it.
 *
 * @throws 404 when the school does not exist
 */
export async function setSchoolStatus(id: string, status: "active" | "suspended", audit: AuditContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const before = await tx.schools.findUnique({ where: { id }, select: { status: true } });
    if (!before) throw notFound("School not found.");
    await tx.schools.updateMany({ where: { id }, data: { status, updated_at: new Date() } });
    await insertAudit(tx, audit, {
      schoolId: id,
      action: status === "active" ? "school.activate" : "school.suspend",
      metadata: { from: before.status, to: status },
    });
  });
  await bumpSchoolCaches(id);
}

/**
 * Add the fixed capacity step to every expected_* total. The increment happens in the database, so
 * two admins clicking at once add both steps instead of overwriting each other.
 *
 * @throws 404 when the school does not exist
 */
export async function increaseSchoolCapacity(id: string, audit: AuditContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.schools.updateMany({
      where: { id },
      data: {
        expected_users: { increment: CAPACITY_STEP.users },
        expected_students: { increment: CAPACITY_STEP.students },
        expected_parents: { increment: CAPACITY_STEP.parents },
        expected_teachers: { increment: CAPACITY_STEP.teachers },
        expected_admins: { increment: CAPACITY_STEP.admins },
        expected_staff: { increment: CAPACITY_STEP.staff },
        updated_at: new Date(),
      },
    });
    if (count === 0) throw notFound("School not found.");
    await insertAudit(tx, audit, { schoolId: id, action: "school.capacity_increase", metadata: { step: CAPACITY_STEP } });
  });
  await bumpSchoolCaches(id);
}

/**
 * Give the school a new login code (at most MAX_CODE_CHANGES times in its life).
 * The update only applies while the counter is still what we read, so two clicks at once cannot
 * both spend the last attempt.
 *
 * @throws 404 missing school; 400 SCHOOL_CODE_BUDGET_USED when all attempts are used; 409 when it changed under us
 */
export async function regenerateSchoolCode(id: string, audit: AuditContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const school = await tx.schools.findUnique({ where: { id }, select: { name: true, code_change_count: true } });
    if (!school) throw notFound("School not found.");

    const used = toCodeChangeCount(school.code_change_count);
    if (used >= MAX_CODE_CHANGES) {
      throw new ApiError(400, "This school has already used all 3 code regeneration attempts.", { code: "SCHOOL_CODE_BUDGET_USED" });
    }

    const nextCode = await findFreeSchoolCode(tx, school.name || "school");
    const { count } = await tx.schools.updateMany({
      where: { id, code_change_count: school.code_change_count },
      data: {
        code: nextCode,
        code_change_count: String(used + 1),
        pending_code_change_at: new Date(Date.now() + CODE_CHANGE_DELAY_MS),
        updated_at: new Date(),
      },
    });
    if (count === 0) throw conflict("This school was just changed by someone else. Please try again.", "SCHOOL_CHANGED");
    await insertAudit(tx, audit, { schoolId: id, action: "school.code_regenerate", metadata: { change_number: used + 1 } });
  });
  await bumpSchoolCaches(id);
}

/* ------------------------------------------------------------------ delete --- */

/**
 * Delete a school. The database cascades to its users, students, teachers, classes and the rest.
 * The audit row is written first, in the same transaction, and has no foreign key so it survives.
 *
 * @throws 404 when the school does not exist; 409 SCHOOL_HAS_LINKED_RECORDS when a record still blocks the delete
 */
export async function deleteSchoolRecord(id: string, audit: AuditContext): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const school = await tx.schools.findUnique({ where: { id }, select: { name: true, code: true } });
      if (!school) throw notFound("School not found.");
      await insertAudit(tx, audit, { schoolId: id, action: "school.delete", metadata: { name: school.name, code: school.code } });
      await tx.schools.deleteMany({ where: { id } });
    });
    await bumpSchoolCaches(id);
  } catch (err) {
    if (dbCode(err) === "P2003") {
      throw conflict("This school still has records that must be removed first.", "SCHOOL_HAS_LINKED_RECORDS");
    }
    throw err;
  }
}

/* --------------------------------------------------------- security codes --- */

/** The fields the security-codes PDF prints, or null when the school does not exist. */
export function findSchoolForCodes(id: string) {
  return prisma.schools.findUnique({ where: { id }, select: { id: true, name: true, code: true, email: true } });
}

/** The stored code hashes of a school (never the codes themselves). */
export function listSecurityCodeRows(schoolId: string) {
  return prisma.school_security_codes.findMany({
    where: { school_id: schoolId },
    select: { code_hash: true, code_label: true, is_active: true, used_count: true },
  });
}

/** Insert the codes a school is missing. Safe to run twice at once: duplicates are skipped. */
export async function insertMissingSecurityCodes(rows: SecurityCodeRow[]): Promise<void> {
  if (rows.length === 0) return;
  await prisma.school_security_codes.createMany({ data: rows, skipDuplicates: true });
}

/* ------------------------------------------------------- email confirmation --- */

/** What the unauthenticated confirmation link needs to check. */
export function findSchoolForConfirmation(id: string) {
  return prisma.schools.findUnique({ where: { id }, select: { id: true, name: true, email: true, status: true } });
}

export type ConfirmOutcome = "activated" | "already_active" | "blocked";

/**
 * Activate a school that is still PENDING. Idempotent: clicking the link again on an active school
 * changes nothing and reports "already_active". A suspended school is never re-activated by an old
 * link ("blocked").
 */
export async function confirmPendingSchool(id: string): Promise<ConfirmOutcome> {
  const { count } = await prisma.schools.updateMany({
    where: { id, status: "pending" },
    data: { status: "active", updated_at: new Date() },
  });
  if (count > 0) {
    await bumpSchoolCaches(id);
    return "activated";
  }

  const current = await prisma.schools.findUnique({ where: { id }, select: { status: true } });
  return current?.status === "active" ? "already_active" : "blocked";
}
