// =============================================================================
// Shared bits for the admin students/teachers validators.
// -----------------------------------------------------------------------------
// Kept separate from lib/validation/shared.ts (owned by the foundation lane).
// =============================================================================

import { z } from "zod";
import { notFound } from "@/lib/api/errors";
import type { Role } from "@/lib/validation/shared";

/**
 * Roles allowed to use the school-admin workspace APIs (reads AND writes).
 * Same set as PORTAL_ROLES.dashboard. Reads are role-gated too because a missing
 * user_page_permissions row means "allowed", which would otherwise let a student
 * or parent account read the whole school register.
 */
export const ADMIN_ROLES: Role[] = ["admin", "super-admin", "manager"];

// Lenient on purpose: accepts any UUID shape (seed data may use non-v4 ids) but
// rejects everything else, which would make Postgres throw "invalid uuid" (a 500).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true when the string looks like a UUID. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Validate an id taken from the URL path.
 *
 * @throws 404 when it is not a UUID: an id that cannot exist is "not found", not a
 *         server error, and answering the same way for every bad id leaks nothing.
 */
export function assertUuid(value: string): string {
  if (!isUuid(value)) throw notFound();
  return value;
}

/** A UUID field in a request body. */
export const uuidSchema = z.string().trim().regex(UUID_PATTERN, "Must be a valid id.");

/**
 * Optional free text that may be cleared: trims, turns "" into null, caps the length.
 * Output is `string | null`; combine with `.optional()` for "leave alone when omitted".
 */
export function nullableText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();
}
