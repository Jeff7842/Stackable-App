// =============================================================================
// School admin validation — zod schemas + the pure privilege rules for the
// /api/school/** routes.
// -----------------------------------------------------------------------------
// Validate at the gate: routes parse with these schemas before any business logic
// runs, so the service can assume clean input (trimmed text, real dates, phone
// digits, whole-number capacities). Unknown keys are stripped (zod default).
//
// The "who may do what" rules are plain functions with no I/O so they can be
// checked without a database (see school-admin.check.ts).
// =============================================================================

import { z } from "zod";
import { nullableText } from "@/lib/validation/admin-common";
import type { Role } from "@/lib/validation/shared";

/* ------------------------------------------------------------- constants --- */

export const SCHOOL_STATUSES = ["active", "pending", "suspended"] as const;
export const SUBSCRIPTION_STATUSES = ["inactive", "active", "expired", "suspended", "trial"] as const;
/** The packages the UI offers. An edit may keep an older custom value, but not introduce a new one. */
export const KNOWN_PACKAGES = ["Seedling", "Branch", "Canopy", "Forest"] as const;
export const SCHOOL_ACTIONS = ["activate", "suspend", "increase_capacity_50", "regenerate_code"] as const;
export type SchoolAction = (typeof SCHOOL_ACTIONS)[number];

/** Actions only a super-admin may run; a school admin may only regenerate their own code. */
export const SUPER_ADMIN_ONLY_ACTIONS: readonly SchoolAction[] = ["activate", "suspend", "increase_capacity_50"];

/** A school may change its login code at most this many times (kept from the old route). */
export const MAX_CODE_CHANGES = 3;

/** Logo uploads: 4 MB is plenty for a crest and keeps pages light. */
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

/** Each capacity field must stay a sane whole number (guards typos like an extra zero x6). */
const MAX_CAPACITY = 1_000_000;

export const SENSITIVE_DENIED_MESSAGE = "Only a super-admin can change this.";

/* ---------------------------------------------------------- field schemas --- */

const emailField = z.string().trim().max(254, "Keep the email under 254 characters.").pipe(z.email("Enter a valid email address."));

/** Empty text and null both mean "clear it"; a missing key means "leave it alone". */
const optionalEmail = z.union([z.literal("").transform(() => null), z.null(), emailField]).optional();

/**
 * A phone number: separators are dropped, then 6-15 digits with an optional "+".
 * Output is digits only (the database column is a bigint; a leading "+" or 0 is not stored).
 */
const phoneField = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{6,15}$/, "Enter a valid phone number (6-15 digits)."))
  .transform((value) => value.replace(/^\+/, ""));

const optionalPhone = z.union([z.literal("").transform(() => null), z.null(), phoneField]).optional();

/** A logo is a link to an image we (or another https host) serve. Never a data: or javascript: URL. */
const logoUrl = z
  .string()
  .trim()
  .max(2048, "Logo link is too long.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Logo must be an http(s) link.");
const optionalLogo = z.union([z.literal("").transform(() => null), z.null(), logoUrl]).optional();

/** A date the UI sends as "YYYY-MM-DD" (or a full ISO string). Stored as a real Date. */
const dateField = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date.")
  .transform((value) => new Date(value));
const optionalDate = z.union([z.literal("").transform(() => null), z.null(), dateField]).optional();

const capacityField = z.coerce
  .number()
  .int("Whole numbers only.")
  .min(0, "Cannot be negative.")
  .max(MAX_CAPACITY, `Keep this under ${MAX_CAPACITY.toLocaleString("en-US")}.`);

const schoolName = z.string().trim().min(2, "School name is required.").max(120, "Keep the name under 120 characters.");
const packageName = z.string().trim().min(1, "Choose a package.").max(60, "Package name is too long.");

/** expires must not be before start (same rule the form shows). */
function checkDateOrder(
  value: { subscription_started_at?: Date | null; subscription_expires_at?: Date | null },
  ctx: z.RefinementCtx,
): void {
  const start = value.subscription_started_at;
  const end = value.subscription_expires_at;
  if (start && end && end.getTime() < start.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["subscription_expires_at"],
      message: "Expiry must be on or after the start date.",
    });
  }
}

/* ------------------------------------------------------------- the bodies --- */

/** POST /api/school. Required: name, email, primary phone (the old page's rule). */
export const createSchoolSchema = z
  .object({
    name: schoolName,
    email: emailField,
    phone_1: phoneField,
    phone_2: optionalPhone,
    phone_3: optionalPhone,
    head_name: nullableText(120).optional(),
    owner_name: nullableText(120).optional(),
    location: nullableText(200).optional(),
    logo: optionalLogo,
    subscription_package: z.enum(KNOWN_PACKAGES, "Choose one of the listed packages.").optional(),
    subscription_status: z.enum(SUBSCRIPTION_STATUSES, "Choose a valid subscription status.").optional(),
    subscription_started_at: optionalDate,
    subscription_expires_at: optionalDate,
    expected_users: capacityField.optional(),
    expected_students: capacityField.optional(),
    expected_parents: capacityField.optional(),
    expected_teachers: capacityField.optional(),
    expected_admins: capacityField.optional(),
    expected_staff: capacityField.optional(),
  })
  .superRefine(checkDateOrder);
export type CreateSchoolParsed = z.infer<typeof createSchoolSchema>;

/**
 * PATCH /api/school/[id]. Every field is optional: a missing key leaves the value alone,
 * null / "" clears it (where the column allows). Sensitive fields are checked against the
 * caller's role in the service (see findSensitiveSchoolChanges).
 */
export const updateSchoolSchema = z
  .object({
    name: schoolName.optional(),
    email: optionalEmail,
    phone_1: phoneField.optional(),
    phone_2: optionalPhone,
    phone_3: optionalPhone,
    head_name: nullableText(120).optional(),
    owner_name: nullableText(120).optional(),
    location: nullableText(200).optional(),
    logo: optionalLogo,
    status: z.enum(SCHOOL_STATUSES, "Choose a valid status.").optional(),
    subscription_package: packageName.optional(),
    subscription_status: z.enum(SUBSCRIPTION_STATUSES, "Choose a valid subscription status.").optional(),
    subscription_started_at: optionalDate,
    subscription_expires_at: optionalDate,
    expected_users: capacityField.optional(),
    expected_students: capacityField.optional(),
    expected_parents: capacityField.optional(),
    expected_teachers: capacityField.optional(),
    expected_admins: capacityField.optional(),
    expected_staff: capacityField.optional(),
  })
  .superRefine(checkDateOrder);
export type SchoolUpdateParsed = z.infer<typeof updateSchoolSchema>;

/** POST /api/school/[id]/actions */
export const schoolActionSchema = z.object({
  action: z.enum(SCHOOL_ACTIONS, "Unsupported action."),
});

/* ------------------------------------------------- privilege rules (pure) --- */

/** The caller, as far as these rules care. */
export type SchoolActor = { role: Role; schoolId: string };

/** super-admin sees every school; everyone else only the school on their own account. */
export function canAccessSchool(actor: SchoolActor, schoolId: string): boolean {
  return actor.role === "super-admin" || actor.schoolId === schoolId;
}

/** Whether `role` may run `action` on a school it can access. */
export function canRunSchoolAction(role: Role, action: SchoolAction): boolean {
  return role === "super-admin" || !SUPER_ADMIN_ONLY_ACTIONS.includes(action);
}

/** The stored values of the fields only a super-admin may change. */
export type SchoolSensitiveSnapshot = {
  status: string;
  subscription_package: string;
  subscription_status: string;
  subscription_started_at: Date | null;
  subscription_expires_at: Date | null;
  expected_users: number;
  expected_students: number;
  expected_parents: number;
  expected_teachers: number;
  expected_admins: number;
  expected_staff: number;
};

const SENSITIVE_TEXT_FIELDS = ["status", "subscription_package", "subscription_status"] as const;
const SENSITIVE_DATE_FIELDS = ["subscription_started_at", "subscription_expires_at"] as const;
const SENSITIVE_CAPACITY_FIELDS = [
  "expected_users",
  "expected_students",
  "expected_parents",
  "expected_teachers",
  "expected_admins",
  "expected_staff",
] as const;

/** Same calendar day (UTC). The form only sends dates, while the database keeps a time of day. */
function sameDay(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * Which sensitive fields does this patch actually CHANGE?
 *
 * The edit form always sends status / package / dates even when the person only fixed a phone
 * number, so "present" is not the test: only a value that differs from what is stored counts.
 * A school admin who changes any of these gets 403; an unchanged echo passes.
 *
 * @param current the stored values
 * @param patch the validated body
 * @returns the names of the sensitive fields whose value would change (empty = none)
 */
export function findSensitiveSchoolChanges(current: SchoolSensitiveSnapshot, patch: SchoolUpdateParsed): string[] {
  const changed: string[] = [];
  for (const field of SENSITIVE_TEXT_FIELDS) {
    const next = patch[field];
    if (next !== undefined && next !== current[field]) changed.push(field);
  }
  for (const field of SENSITIVE_DATE_FIELDS) {
    const next = patch[field];
    if (next !== undefined && !sameDay(current[field], next)) changed.push(field);
  }
  for (const field of SENSITIVE_CAPACITY_FIELDS) {
    const next = patch[field];
    if (next !== undefined && next !== current[field]) changed.push(field);
  }
  return changed;
}

/** A package edit may keep the stored (possibly custom) value or pick one of the known packages. */
export function isPackageAllowed(next: string, stored: string): boolean {
  return next === stored || (KNOWN_PACKAGES as readonly string[]).includes(next);
}
