// =============================================================================
// User repository — the ONLY place that reads/writes user data via Prisma.
// -----------------------------------------------------------------------------
// API routes call these functions; they never touch Prisma directly. Results
// are scoped by the optional filters (schoolId, role, status, search).
//
// Type conversions applied to match JSON output:
//   BigInt -> number, Date -> ISO string.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { ApiError, notFound } from "@/lib/api/errors";
import { cached, bumpCache } from "@/lib/cache";
import { insertAudit, type AuditContext } from "@/lib/repositories/audit-log.repo";
import type { CreateUserParsed, UpdateUserParsed } from "@/lib/validation/user-admin";

// Only a real (single) schoolId filter is cacheable per-tenant; "all schools" (super-admin,
// no filter) is a much less common view, and every user's data is in it, so a version bump
// there would fire on nearly every write anyway - not worth the bucket.
const USERS_CACHE_TTL = 30;

export type UserPermission = {
  page_key: string;
  can_access: boolean;
};

export type UserListItem = {
  id: string;
  created_at: string;
  updated_at: string;
  school_id: string;
  school_code: string;
  school_adm: number | null;
  email: string | null;
  phone: number | null;
  phone_2: number | null;
  role: string;
  status: string;
  first_name: string;
  last_name: string;
  must_change_password: boolean;
  schools: { id: string; name: string; code: string } | null;
  permissions: UserPermission[];
};

/**
 * List users with their school info and page permissions.
 * Mirrors the shape the admin GET /api/admin/users handler returns.
 * All filters are optional; omitting them returns all users.
 */
export async function listUsersWithPermissions(opts: {
  schoolId?: string;
  role?: string;
  status?: string;
  search?: string;
} = {}): Promise<UserListItem[]> {
  const cacheableSchoolId = opts.schoolId && opts.schoolId !== "all" ? opts.schoolId : null;
  if (cacheableSchoolId) {
    // role/status/search vary a lot (typed live in the UI); cache only the common, unfiltered
    // "everyone at this school" read that the page loads with, and filter client-side elsewhere.
    const isUnfiltered = (!opts.role || opts.role === "all") && (!opts.status || opts.status === "all") && !opts.search;
    if (isUnfiltered) {
      return cached(cacheableSchoolId, "users-list", USERS_CACHE_TTL, () => listUsersWithPermissionsUncached(opts));
    }
  }
  return listUsersWithPermissionsUncached(opts);
}

async function listUsersWithPermissionsUncached(opts: {
  schoolId?: string;
  role?: string;
  status?: string;
  search?: string;
}): Promise<UserListItem[]> {
  const where: Record<string, unknown> = {};
  if (opts.schoolId && opts.schoolId !== "all") where.school_id = opts.schoolId;
  if (opts.role && opts.role !== "all") where.role = opts.role;
  if (opts.status && opts.status !== "all") where.status = opts.status;

  const users = await prisma.users.findMany({
    where,
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      created_at: true,
      updated_at: true,
      school_id: true,
      school_code: true,
      school_adm: true,
      email: true,
      phone: true,
      phone_2: true,
      role: true,
      status: true,
      first_name: true,
      last_name: true,
      must_change_password: true,
      schools: {
        select: { id: true, name: true, code: true },
      },
      user_page_permissions: {
        select: { page_key: true, can_access: true },
      },
    },
  });

  // Apply search filter in memory to match the Supabase route's behavior.
  const search = opts.search?.toLowerCase() ?? "";
  const filtered = search
    ? users.filter((u) => {
        const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        const phone = String(u.phone ?? "").toLowerCase();
        const phone2 = String(u.phone_2 ?? "").toLowerCase();
        const schoolName = (u.schools?.name ?? "").toLowerCase();
        const role = u.role.toLowerCase();
        return (
          fullName.includes(search) ||
          email.includes(search) ||
          phone.includes(search) ||
          phone2.includes(search) ||
          schoolName.includes(search) ||
          role.includes(search)
        );
      })
    : users;

  return filtered.map((u) => ({
    id: u.id,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
    school_id: u.school_id,
    school_code: u.school_code,
    school_adm: u.school_adm == null ? null : Number(u.school_adm),
    email: u.email ?? null,
    phone: u.phone == null ? null : Number(u.phone),
    phone_2: u.phone_2 == null ? null : Number(u.phone_2),
    role: u.role,
    status: u.status,
    first_name: u.first_name,
    last_name: u.last_name,
    must_change_password: u.must_change_password,
    schools: u.schools
      ? { id: u.schools.id, name: u.schools.name, code: u.schools.code }
      : null,
    permissions: u.user_page_permissions.map((p) => ({
      page_key: p.page_key,
      can_access: p.can_access,
    })),
  }));
}

/* --------------------------------------------------------------- targets --- */

/** The fields checkUserUpdate/checkUserDelete need to decide if an action is allowed. */
export function findUserTarget(id: string) {
  return prisma.users.findUnique({
    where: { id },
    select: { id: true, school_id: true, role: true, status: true },
  });
}

/* --------------------------------------------------------------- db errors --- */

function dbCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

/* ------------------------------------------------------------------ create --- */

const optionalBigInt = (value: string | null | undefined): bigint | null | undefined =>
  value === undefined ? undefined : value === null ? null : BigInt(value);

/**
 * Create a user (status "pending", must_change_password true - unchanged from the old route),
 * its optional profile photo and its page-permission rows, in one transaction with the audit row.
 *
 * @throws 409 EMAIL_TAKEN when the (school_id, email) pair is already used
 */
export async function createUserRecord(
  input: CreateUserParsed,
  audit: AuditContext,
): Promise<{ id: string }> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email ?? null,
          phone: optionalBigInt(input.phone) ?? null,
          phone_2: optionalBigInt(input.phone_2) ?? null,
          school_id: input.school_id,
          role: input.role,
          status: "pending",
          must_change_password: true,
        },
        select: { id: true },
      });

      if (input.photo_url) {
        await tx.user_profiles.upsert({
          where: { user_id: user.id },
          create: { user_id: user.id, photo_url: input.photo_url },
          update: { photo_url: input.photo_url, updated_at: new Date() },
        });
      }

      if (input.permissions?.length) {
        await tx.user_page_permissions.createMany({
          data: input.permissions.map((p) => ({ user_id: user.id, page_key: p.page_key, can_access: p.can_access })),
        });
      }

      await insertAudit(tx, audit, {
        schoolId: input.school_id,
        action: "user.create",
        targetUserId: user.id,
        metadata: { role: input.role },
      });

      return user;
    });
    await bumpCache(input.school_id, "users");
    return created;
  } catch (err) {
    if (dbCode(err) === "P2002") {
      throw new ApiError(409, "A user with this email already exists at this school.", { code: "EMAIL_TAKEN" });
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ update --- */

/**
 * Apply an edit: the users row, its permission rows (full replace when `permissions` is present),
 * in one transaction with the audit row.
 *
 * @throws 404 when the user no longer exists; 409 EMAIL_TAKEN on a duplicate (school_id, email)
 */
export async function updateUserRecord(
  patch: UpdateUserParsed,
  audit: AuditContext,
): Promise<void> {
  const { id, permissions, clear_history: _clearHistory, ...rest } = patch;
  void _clearHistory; // activity_logs / login_history / notifications never existed in this database
  try {
    const schoolId = await prisma.$transaction(async (tx) => {
      const before = await tx.users.findUnique({ where: { id }, select: { school_id: true } });
      if (!before) throw notFound("User not found.");

      await tx.users.updateMany({ where: { id }, data: rest });

      if (permissions) {
        await tx.user_page_permissions.deleteMany({ where: { user_id: id } });
        if (permissions.length) {
          await tx.user_page_permissions.createMany({
            data: permissions.map((p) => ({ user_id: id, page_key: p.page_key, can_access: p.can_access })),
          });
        }
      }

      await insertAudit(tx, audit, { schoolId: before.school_id, action: "user.update", targetUserId: id, metadata: { fields: Object.keys(rest) } });
      return before.school_id;
    });
    await bumpCache(schoolId, "users");
  } catch (err) {
    if (dbCode(err) === "P2002") {
      throw new ApiError(409, "A user with this email already exists at this school.", { code: "EMAIL_TAKEN" });
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ delete --- */

/**
 * Delete a user. The database cascades to their profile, permissions and sessions. The audit row
 * is written first, in the same transaction, and has no foreign key so it survives.
 *
 * @throws 404 when the user does not exist; 409 when a linked record still blocks the delete
 */
export async function deleteUserRecord(id: string, audit: AuditContext): Promise<void> {
  try {
    const schoolId = await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id }, select: { school_id: true, role: true } });
      if (!user) throw notFound("User not found.");
      await insertAudit(tx, audit, { schoolId: user.school_id, action: "user.delete", targetUserId: id, metadata: { role: user.role } });
      await tx.users.deleteMany({ where: { id } });
      return user.school_id;
    });
    await bumpCache(schoolId, "users");
  } catch (err) {
    if (dbCode(err) === "P2003") {
      throw new ApiError(409, "This user still has records that must be removed first.", { code: "USER_HAS_LINKED_RECORDS" });
    }
    throw err;
  }
}
