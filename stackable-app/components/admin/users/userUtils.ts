// =============================================================================
// Small pure helpers shared by the Users & permissions components.
// (No React, no data fetching: easy to read and to test.)
// =============================================================================

import type { Role, UserStatus } from "@/lib/validation/shared";
import type { AdminUser, AdminUserPermission, AssignableRole } from "@/hooks/useAdminUsers";

/* ---- labels ---- */

export const ROLE_LABEL: Record<Role, string> = {
  "super-admin": "Super admin",
  admin: "Admin",
  manager: "Manager",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  pupil: "Pupil",
  staff: "Staff",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Active",
  pending: "Pending",
  suspended: "Suspended",
};

/** Every role the API can return (the list filter). */
export const FILTER_ROLES: Role[] = [
  "manager",
  "admin",
  "super-admin",
  "teacher",
  "student",
  "parent",
  "staff",
  "pupil",
];

/** Roles offered by the create form (same three as the old page). */
export const CREATE_ROLES: AssignableRole[] = ["manager", "admin", "super-admin"];

export const STATUSES: UserStatus[] = ["pending", "active", "suspended"];

/** Roles whose page access can be tuned with the permission matrix. */
export function isAdminLevel(role: Role | string): boolean {
  return role === "admin" || role === "super-admin";
}

/* ---- display ---- */

export function getFullName(user: Pick<AdminUser, "first_name" | "last_name">): string {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unnamed user";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** "some_page_key" -> "some page key" (capitalised by CSS where shown). */
export function pageLabel(key: string): string {
  return key.replace(/_/g, " ");
}

/* ---- page permissions ----
 * Semantics (mirrors lib/api/guard.ts): a page with no row is ALLOWED; only an
 * explicit can_access=false blocks it. */

export function isAllowed(perms: AdminUserPermission[] | undefined, key: string): boolean {
  return perms?.find((p) => p.page_key === key)?.can_access ?? true;
}

export function setAccess(
  perms: AdminUserPermission[],
  key: string,
  can_access: boolean,
): AdminUserPermission[] {
  return [...perms.filter((p) => p.page_key !== key), { page_key: key, can_access }];
}

export function setAllAccess(pageKeys: string[], can_access: boolean): AdminUserPermission[] {
  return pageKeys.map((page_key) => ({ page_key, can_access }));
}

/** Same effective access on every page? (Explicit-true rows equal "no row".) */
export function sameAccess(
  a: AdminUserPermission[] | undefined,
  b: AdminUserPermission[] | undefined,
  pageKeys: string[],
): boolean {
  return pageKeys.every((key) => isAllowed(a, key) === isAllowed(b, key));
}

/* ---- form validation (light client-side guards; the server stays the authority) ---- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_RE = /^\+?\d{6,15}$/u;

export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim());

/** Drop spaces, dashes and brackets people type into phone numbers. */
export const normalizePhone = (value: string) => value.replace(/[\s\-()]/gu, "");
export const isValidPhone = (value: string) => PHONE_RE.test(normalizePhone(value));

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/iu.test(value.trim());

/* ---- who may change whom ----
 * Client-side courtesy rules so nobody locks themselves out or edits a
 * super-admin by accident. The API is still the only real enforcement point. */

export type Viewer = { id?: string; role?: Role };

export function accessRules(target: Pick<AdminUser, "id" | "role">, viewer: Viewer) {
  const isSelf = Boolean(viewer.id) && target.id === viewer.id;
  // Only a super-admin may touch a super-admin account.
  const readOnly = target.role === "super-admin" && viewer.role !== "super-admin";
  return { isSelf, readOnly, lockAccess: isSelf || readOnly };
}

/* ---- edit-drawer draft ---- */

/** The fields the user drawer lets you change (what PATCH /api/admin/users accepts). */
export type UserDraft = {
  email: string;
  status: UserStatus;
  role: Role;
  must_change_password: boolean;
  permissions: AdminUserPermission[];
};

export const toDraft = (u: AdminUser): UserDraft => ({
  email: u.email ?? "",
  status: u.status,
  role: u.role,
  must_change_password: u.must_change_password,
  permissions: u.permissions ?? [],
});
