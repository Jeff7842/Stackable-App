// =============================================================================
// User admin validation — zod schemas + the pure privilege rules for
// /api/admin/users (list, create, update, delete).
// -----------------------------------------------------------------------------
// The rules below answer "may THIS caller do THIS to THAT user?" with no database
// access, so they are cheap to test (see school-admin.check.ts) and the service only
// has to load the target user and apply them.
// =============================================================================

import { z } from "zod";
import { uuidSchema } from "@/lib/validation/admin-common";
import { PAGE_KEYS, ROLES, USER_STATUSES, type Role, type UserStatus } from "@/lib/validation/shared";

/** Only admins manage other users (managers get 403; the page shows a "restricted" state). */
export const USER_ADMIN_ROLES: Role[] = ["admin", "super-admin"];

/** Roles the API accepts on create / update (same list as before the Prisma port). */
export const ASSIGNABLE_ROLES = ["manager", "admin", "super-admin", "teacher", "student"] as const;

/** A person's page-permission list can never be longer than the page list itself. */
const MAX_PERMISSIONS = PAGE_KEYS.length;

const KNOWN_PAGE_KEYS: readonly string[] = PAGE_KEYS;

const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(80, `Keep ${label.toLowerCase()} under 80 characters.`);

const emailField = z.string().trim().max(254, "Keep the email under 254 characters.").pipe(z.email("Enter a valid email address."));
const optionalEmail = z.union([z.literal("").transform(() => null), z.null(), emailField]).optional();

/** Digits only after removing separators; the users table stores phones as bigint. */
const phoneField = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number (6-15 digits)."))
  .transform((value) => value.replace(/^\+/, ""));
const optionalPhone = z.union([z.literal("").transform(() => null), z.null(), phoneField]).optional();

const photoUrl = z
  .string()
  .trim()
  .max(2048, "Photo link is too long.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Photo must be an http(s) link.");
const optionalPhoto = z.union([z.literal("").transform(() => null), z.null(), photoUrl]).optional();

/**
 * One page-permission row. Unknown page keys are dropped (not an error): the old route did the
 * same, and a stale UI listing a removed page should not fail the whole save.
 */
const permissionsField = z
  .array(z.object({ page_key: z.string(), can_access: z.boolean() }))
  .max(MAX_PERMISSIONS, "Too many permission rows.")
  .transform((rows) => rows.filter((row) => KNOWN_PAGE_KEYS.includes(row.page_key)));

/* ------------------------------------------------------------- the inputs --- */

/** GET /api/admin/users query string. "all" (or missing) means no filter. */
export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100, "Search is too long.").optional().default(""),
  role: z.enum(["all", ...ROLES]).optional().default("all"),
  status: z.enum(["all", ...USER_STATUSES]).optional().default("all"),
  schoolId: z.union([z.literal("all"), uuidSchema]).optional().default("all"),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** POST /api/admin/users */
export const createUserSchema = z.object({
  first_name: nameField("First name"),
  last_name: nameField("Last name"),
  school_id: uuidSchema,
  role: z.enum(ASSIGNABLE_ROLES, "Invalid role."),
  email: optionalEmail,
  phone: optionalPhone,
  phone_2: optionalPhone,
  photo_url: optionalPhoto,
  permissions: permissionsField.optional(),
});
export type CreateUserParsed = z.infer<typeof createUserSchema>;

/** PATCH /api/admin/users (the id travels in the body, as the hook sends it). */
export const updateUserSchema = z.object({
  id: uuidSchema,
  email: optionalEmail,
  status: z.enum(USER_STATUSES, "Invalid status.").optional(),
  role: z.enum(ASSIGNABLE_ROLES, "Invalid role.").optional(),
  must_change_password: z.boolean().optional(),
  permissions: permissionsField.optional(),
  clear_history: z.boolean().optional(),
});
export type UpdateUserParsed = z.infer<typeof updateUserSchema>;

/** DELETE /api/admin/users?id= */
export const deleteUserQuerySchema = z.object({ id: uuidSchema });

/* ------------------------------------------------- privilege rules (pure) --- */

export const SUPER_ADMIN_ONLY_MESSAGE = "Only a super-admin can change this.";

/** The caller. */
export type UserActor = { id: string; role: Role; schoolId: string };

/** The user being changed, as stored. */
export type UserTarget = { id: string; school_id: string; role: string; status: string };

/** Why a request is refused. 404 hides that a user in another school exists. */
export type UserDenial = { status: 403 | 404; code: string; message: string };

const NOT_FOUND: UserDenial = { status: 404, code: "NOT_FOUND", message: "User not found." };
const SCHOOL_NOT_FOUND: UserDenial = { status: 404, code: "NOT_FOUND", message: "School not found." };
const SUPER_ADMIN_ONLY: UserDenial = { status: 403, code: "FORBIDDEN", message: SUPER_ADMIN_ONLY_MESSAGE };

/**
 * May the caller create this user?
 *  - a school admin only creates users in their own school (another school reads as "not found");
 *  - only a super-admin may create a super-admin.
 *
 * @returns null when allowed, otherwise the refusal
 */
export function checkUserCreate(actor: UserActor, input: { school_id: string; role: string }): UserDenial | null {
  if (actor.role === "super-admin") return null;
  if (input.school_id !== actor.schoolId) return SCHOOL_NOT_FOUND;
  if (input.role === "super-admin") return SUPER_ADMIN_ONLY;
  return null;
}

/**
 * May the caller change this user?
 *  - a school admin only touches users of their own school (others read as "not found");
 *  - a super-admin account can only be changed by a super-admin, and only a super-admin may hand
 *    out the super-admin role;
 *  - nobody changes their OWN role or status (an admin promoting themselves, or a super-admin
 *    locking the platform by suspending themselves). Echoing the current value is fine because the
 *    edit form always sends status.
 *
 * @returns null when allowed, otherwise the refusal
 */
export function checkUserUpdate(
  actor: UserActor,
  target: UserTarget,
  patch: { role?: string; status?: string },
): UserDenial | null {
  if (actor.role !== "super-admin") {
    if (target.school_id !== actor.schoolId) return NOT_FOUND;
    if (target.role === "super-admin") return SUPER_ADMIN_ONLY;
    if (patch.role === "super-admin") return SUPER_ADMIN_ONLY;
  }
  if (actor.id === target.id) {
    const roleChanges = patch.role !== undefined && patch.role !== target.role;
    const statusChanges = patch.status !== undefined && patch.status !== target.status;
    if (roleChanges || statusChanges) {
      return { status: 403, code: "FORBIDDEN", message: "You cannot change your own role or status." };
    }
  }
  return null;
}

/**
 * May the caller delete this user? (The route is already super-admin only.)
 * Deleting your own account is refused: it would end your session and cascade your records.
 */
export function checkUserDelete(actor: UserActor, target: UserTarget): UserDenial | null {
  if (actor.role !== "super-admin") return SUPER_ADMIN_ONLY;
  if (actor.id === target.id) {
    return { status: 403, code: "FORBIDDEN", message: "You cannot delete your own account." };
  }
  return null;
}

/** Narrow helper for callers that hold a plain string status. */
export function isUserStatus(value: string): value is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(value);
}
