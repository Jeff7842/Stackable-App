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
