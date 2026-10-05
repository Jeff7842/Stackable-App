// =============================================================================
// Shared validation building blocks.
// -----------------------------------------------------------------------------
// The roles, statuses, and page keys are defined ONCE here so the whole app
// agrees on them. Before, the list of roles/pages was copied into several files.
// =============================================================================

import { z } from "zod";

// The roles allowed by the database (users.role CHECK constraint).
// finance, secretary and driver use the /staff portal; dept-head uses /teach (SDD page map P4-18).
export const ROLES = [
  "super-admin",
  "admin",
  "manager",
  "teacher",
  "dept-head",
  "parent",
  "student",
  "pupil",
  "staff",
  "finance",
  "secretary",
  "driver",
] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

// Which roles belong to which dashboard (route group). See the plan's matrix.
export const ROLE_DASHBOARD: Record<Role, "principal" | "teacher" | "student" | "parent" | "developer" | "staff"> = {
  "super-admin": "developer", // also allowed into principal; see guard
  admin: "principal",
  manager: "principal",
  teacher: "teacher",
  "dept-head": "teacher",
  staff: "teacher",
  finance: "staff",
  secretary: "staff",
  driver: "staff",
  student: "student",
  pupil: "student",
  parent: "parent",
};

// Portals = the route groups. "dashboard" is the /dashboard/* school-admin workspace.
export type Portal = "developer" | "principal" | "dashboard" | "teacher" | "staff" | "student" | "parent";

// Roles allowed into each portal. A real super-admin may enter developer/principal/dashboard;
// while impersonating, the session resolves to the target user, so these checks apply to them.
export const PORTAL_ROLES: Record<Portal, readonly Role[]> = {
  developer: ["super-admin"],
  principal: ["admin", "manager", "super-admin"],
  dashboard: ["admin", "manager", "super-admin"],
  teacher: ["teacher", "dept-head", "staff"],
  staff: ["finance", "secretary", "driver"],
  student: ["student", "pupil"],
  parent: ["parent"],
};

// Where each role lands after login, and where a wrong-portal visit is sent back to.
export const ROLE_HOME: Record<Role, string> = {
  "super-admin": "/dev",
  admin: "/admin",
  manager: "/admin",
  teacher: "/teach",
  "dept-head": "/teach",
  staff: "/teach",
  finance: "/staff",
  secretary: "/staff",
  driver: "/staff",
  student: "/learn",
  pupil: "/learn",
  parent: "/family",
};

// Account status (users.status CHECK constraint).
export const USER_STATUSES = ["active", "suspended", "pending"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
export const userStatusSchema = z.enum(USER_STATUSES);

// Page keys used by user_page_permissions for fine-grained access within a role.
export const PAGE_KEYS = [
  "dashboard",
  "users",
  "students",
  "teachers",
  "staff",
  "parents",
  "classes",
  "subjects",
  "payments",
  "library",
  "exams",
  "assignments",
  "reports",
  "notifications",
  "settings",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];
export const pageKeySchema = z.enum(PAGE_KEYS);

// Reusable field schemas.
export const idSchema = z.string().min(1);
export const emailSchema = z.string().email();
// Phones in the DB are bigint; the UI sends strings. Accept digits, store as needed.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{6,15}$/u, "Enter a valid phone number.");
