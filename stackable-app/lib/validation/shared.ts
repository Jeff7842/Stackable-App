// =============================================================================
// Shared validation building blocks.
// -----------------------------------------------------------------------------
// The roles, statuses, and page keys are defined ONCE here so the whole app
// agrees on them. Before, the list of roles/pages was copied into several files.
// =============================================================================

import { z } from "zod";

// The 8 roles that exist in the database (users.role CHECK constraint).
export const ROLES = [
  "super-admin",
  "admin",
  "manager",
  "teacher",
  "parent",
  "student",
  "pupil",
  "staff",
] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

// Which roles belong to which dashboard (route group). See the plan's matrix.
export const ROLE_DASHBOARD: Record<Role, "principal" | "teacher" | "student" | "parent" | "developer"> = {
  "super-admin": "developer", // also allowed into principal; see guard
  admin: "principal",
  manager: "principal",
  teacher: "teacher",
  staff: "teacher",
  student: "student",
  pupil: "student",
  parent: "parent",
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
