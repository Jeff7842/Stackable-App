// =============================================================================
// Student admin validation — zod schemas for the /api/students/** write routes.
// -----------------------------------------------------------------------------
// Validate at the gate: routes call these before any business logic runs.
// =============================================================================

import { z } from "zod";
import { STUDENT_STATUSES, type StudentUpdateInput } from "@/lib/dto/students";
import { nullableText, uuidSchema } from "@/lib/validation/admin-common";

/** true for a real calendar date written as YYYY-MM-DD (rejects 2024-02-31). */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** A date of birth: a real calendar date that is not in the future. "" clears it. */
const dateOfBirthSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    if (!isCalendarDate(value)) {
      ctx.addIssue({ code: "custom", message: "Enter the date as YYYY-MM-DD." });
      return z.NEVER;
    }
    // Compare as text: YYYY-MM-DD sorts like the dates it stands for.
    if (value > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future." });
      return z.NEVER;
    }
    return value;
  })
  .nullable();

/**
 * PATCH /api/students/[id] body. All keys optional; at least one must be present.
 * Names, admission number, email and school are not editable here: they mirror the
 * student's login account and the school they belong to.
 */
export const studentUpdateSchema = z
  .object({
    status: z.enum(STUDENT_STATUSES, "Status must be active, suspended, pending, removed or graduated.").optional(),
    class_id: uuidSchema.nullable().optional(),
    phone: nullableText(32).optional(),
    phone2: nullableText(32).optional(),
    date_of_birth: dateOfBirthSchema.optional(),
    location: nullableText(200).optional(),
    home_address: nullableText(300).optional(),
    emergency_contact: nullableText(200).optional(),
    health_status: nullableText(300).optional(),
    other_info: nullableText(1000).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Send at least one field to update.",
  });

export type StudentUpdateParsed = z.output<typeof studentUpdateSchema>;

// Drift guard: fails typecheck if the DTO and the schema disagree.
type DtoCoversSchemaInput = StudentUpdateInput extends z.input<typeof studentUpdateSchema> ? true : never;
export const STUDENT_SCHEMA_IN_SYNC: DtoCoversSchemaInput = true;
