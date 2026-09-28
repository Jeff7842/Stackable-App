// =============================================================================
// Teacher admin validation — zod schemas for the /api/teachers/** write routes.
// -----------------------------------------------------------------------------
// Validate at the gate: routes call these before any business logic runs, so the
// service can assume clean, normalised input (times as "HH:MM", days lower-case,
// class/subject ids in the right shape).
// =============================================================================

import { z } from "zod";
import { badRequest } from "@/lib/api/errors";
import { parse, parseJson } from "@/lib/api/validate";
import {
  MAX_TEACHER_SUBJECTS,
  MAX_TIMETABLE_SLOTS,
  TEACHER_STATUSES,
  TIMETABLE_DAYS,
  TIMETABLE_ITEM_TYPES,
  type TeacherUpdateInput,
  type TimetableSlotInput,
  type TimetableWriteRow,
} from "@/lib/dto/teachers";
import { normalizeTime, timeToMinutes } from "@/lib/timetable";
import { nullableText, uuidSchema } from "@/lib/validation/admin-common";

/** A time of day; accepts "8:00", "08:00", "08:00:00" and stores "HH:MM". */
const timeField = z.string().transform((value, ctx) => {
  const normalized = normalizeTime(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Enter a time as HH:MM." });
    return z.NEVER;
  }
  return normalized;
});

/**
 * One timetable block. Mirrors the old edit page: only "class" blocks carry a class
 * and subject; event/duty/task blocks carry a title instead. The other fields are
 * cleared here so the database never stores a meaningless combination.
 */
export const timetableSlotSchema = z
  .object({
    id: z.string().optional(), // ignored: the whole timetable is replaced on save
    class_id: uuidSchema.nullable().optional(),
    subject_id: z.number().int().positive().nullable().optional(),
    day_of_week: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(TIMETABLE_DAYS, "Choose a day from Monday to Sunday.")),
    start_time: timeField,
    end_time: timeField,
    room: nullableText(60).optional(),
    item_type: z.enum(TIMETABLE_ITEM_TYPES, "Item type must be class, event, duty or task.").optional(),
    title: nullableText(120).optional(),
    notes: nullableText(1000).optional(),
  })
  .superRefine((slot, ctx) => {
    // A slot that ends before it starts can never be shown on the grid.
    if (timeToMinutes(slot.end_time) <= timeToMinutes(slot.start_time)) {
      ctx.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "End time must be after the start time.",
      });
    }
  })
  .transform((slot): TimetableWriteRow => {
    const itemType = slot.item_type ?? "class";
    const isClassBlock = itemType === "class";
    return {
      class_id: isClassBlock ? (slot.class_id ?? null) : null,
      subject_id: isClassBlock ? (slot.subject_id ?? null) : null,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room ?? null,
      item_type: itemType,
      title: isClassBlock ? null : (slot.title ?? null),
      notes: slot.notes ?? null,
    };
  });

/** Whole-timetable replacement (PUT /api/teachers/[id]/timetable). */
export const timetableSaveSchema = z.object({
  slots: z.array(timetableSlotSchema).max(MAX_TIMETABLE_SLOTS, `A timetable can hold at most ${MAX_TIMETABLE_SLOTS} items.`),
});

/**
 * PATCH /api/teachers/[id] body. All keys optional; at least one must be present.
 * school_id is deliberately NOT accepted: a teacher never moves between schools here.
 */
export const teacherUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120).optional(),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email("Enter a valid email address."))
      .optional(),
    phone: nullableText(32).optional(),
    admission_number: z.string().trim().min(1, "Teacher ID is required.").max(64).optional(),
    status: z.enum(TEACHER_STATUSES, "Status must be active, suspended, on_leave, retired or terminated.").optional(),
    class_teacher: z.boolean().optional(),
    class_teacher_class_id: uuidSchema.nullable().optional(),
    subject_ids: z
      .array(z.number().int().positive())
      .max(MAX_TEACHER_SUBJECTS)
      .transform((ids) => Array.from(new Set(ids))) // first occurrence wins, so the primary subject stays first
      .optional(),
    timetable: z
      .array(timetableSlotSchema)
      .max(MAX_TIMETABLE_SLOTS, `A timetable can hold at most ${MAX_TIMETABLE_SLOTS} items.`)
      .optional(),
    remove_photo: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Send at least one field to update.",
  });

export type TeacherUpdateParsed = z.output<typeof teacherUpdateSchema>;
export type TimetableSaveParsed = z.output<typeof timetableSaveSchema>;

// Drift guards: if the DTO the UI codes against and the schema stop agreeing,
// typecheck fails here instead of the UI failing at runtime.
type DtoCoversSchemaInput = TeacherUpdateInput extends z.input<typeof teacherUpdateSchema> ? true : never;
type SlotDtoCoversSchemaInput = TimetableSlotInput extends z.input<typeof timetableSlotSchema> ? true : never;
export const TEACHER_SCHEMA_IN_SYNC: DtoCoversSchemaInput & SlotDtoCoversSchemaInput = true;

/**
 * Read the PATCH request: either plain JSON, or multipart with a `payload` field
 * (the JSON) and an optional `photo` file (needed because a file cannot travel in JSON).
 *
 * @param req the incoming request
 * @returns the validated changes and the uploaded photo, if any
 * @throws 400 on an unreadable body or invalid fields
 */
export async function readTeacherUpdateRequest(
  req: Request,
): Promise<{ input: TeacherUpdateParsed; photo: File | null }> {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (!contentType.includes("multipart/form-data")) {
    return { input: await parseJson(req, teacherUpdateSchema), photo: null };
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Request body must be valid multipart form data.");
  }

  const rawPayload = form.get("payload");
  let raw: unknown = {};
  if (typeof rawPayload === "string" && rawPayload.trim() !== "") {
    try {
      raw = JSON.parse(rawPayload);
    } catch {
      throw badRequest("The payload field must be valid JSON.");
    }
  }

  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  // A photo alone is a valid update, so give the "at least one field" rule something to see.
  const base = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const candidate = hasPhoto && Object.keys(base).length === 0 ? { remove_photo: false } : base;

  return { input: parse(teacherUpdateSchema, candidate), photo: hasPhoto ? photo : null };
}

/** Query string of GET /api/teachers/[id]/attendance. */
export const attendanceQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/** Query string of DELETE /api/teachers/[id]. */
export const teacherDeleteQuerySchema = z.object({
  force: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

/** Text fields of POST /api/teachers (multipart). The photo travels as a file, not in here. */
export const teacherCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")),
  phone: z.string().trim().min(1, "Phone number is required.").max(32),
  admission_number: z.string().trim().min(1, "Teacher ID is required.").max(64),
  class_id: uuidSchema,
  subject_id: z.coerce.number().int().positive(),
});

export type TeacherCreateParsed = z.output<typeof teacherCreateSchema>;

/** Same wording the create form has always shown when a field is empty. */
const CREATE_REQUIRED_MESSAGE =
  "Name, email, phone number, teacher ID, school, class, and subject are required.";

/**
 * Read the multipart body of POST /api/teachers.
 *
 * Why the two-step check: the create form has always shown one combined "required" message
 * for an empty field and a separate one for the photo; those texts are kept so the UI does not change.
 *
 * @throws 400 on a missing field, missing photo or an invalid value
 */
export async function readTeacherCreateRequest(
  req: Request,
): Promise<{ input: TeacherCreateParsed; photo: File }> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Request body must be valid multipart form data.");
  }

  const text = (key: string): string => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const raw = {
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    admission_number: text("admission_number"),
    class_id: text("class_id"),
    subject_id: text("subject_id"),
  };

  const subjectNumber = Number(raw.subject_id);
  const hasMissingField =
    Object.values(raw).some((value) => value === "") || !Number.isFinite(subjectNumber) || subjectNumber <= 0;
  if (hasMissingField) throw badRequest(CREATE_REQUIRED_MESSAGE);

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) throw badRequest("Teacher photo is required.");

  return { input: parse(teacherCreateSchema, raw), photo };
}
