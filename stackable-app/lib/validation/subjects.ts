// =============================================================================
// Subjects — request schemas + upload rules.
// -----------------------------------------------------------------------------
// One place that decides what the /api/subjects/** routes accept. The routes call
// these BEFORE any business logic; services can then trust their inputs.
//
// Design rules (so the old admin UI keeps working unchanged):
//   * "Empty" is not "wrong". The old forms send "" for blank inputs and 0 for a
//     cleared number box, so blanks become null (or the default) instead of an error.
//   * Missing REQUIRED fields (title, class, ...) are NOT rejected here. The routes
//     keep their old messages ("Assessment title, type, and target classes are
//     required.") so nothing a client may match on changes.
//   * Wrong shapes/values (bad id, unknown enum, too long, bad URL, end before
//     start, ...) are rejected with a 400 that names the field.
//   * Tenancy is never in these schemas: school_id / created_by / uploaded_by sent
//     by a client are dropped. The session decides who and where.
// =============================================================================

import { z } from "zod";
import {
  ASSESSMENT_TYPE_OPTIONS,
  ASSIGNMENT_ROLE_OPTIONS,
  CURRICULUM_NODE_TYPE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  RESOURCE_TYPE_OPTIONS,
  RESOURCE_VISIBILITY_OPTIONS,
  SUBJECT_BACKGROUND_MAX_BYTES,
  SUBJECT_CATEGORY_OPTIONS,
  SUBJECT_RESOURCE_MAX_BYTES,
  SUBJECT_TYPE_OPTIONS,
} from "@/lib/subjects";

// ---------------------------------------------------------------------------
// Tiny building blocks
// ---------------------------------------------------------------------------

// Postgres accepts any 8-4-4-4-12 hex uuid, so we do too (z.uuid() is stricter).
const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** True when the value is a uuid string. Used to guard ids before they reach SQL. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** True for absolute http(s) URLs only. Blocks javascript:, data:, file: and friends. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const uuidLike = z.string().regex(UUID_PATTERN, "Invalid ID.");

/** null/undefined/blank -> null, otherwise the trimmed text. */
function emptyToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Number, numeric string, or null when blank / not a finite number. */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const optText = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max, `Use ${max} characters or fewer.`).nullable());

const optUuid = z.preprocess(emptyToNull, uuidLike.nullable());

const boolWithDefault = (fallback: boolean) =>
  z.preprocess((value) => (typeof value === "boolean" ? value : fallback), z.boolean());

function enumWithDefault<T extends readonly [string, ...string[]]>(options: T, fallback: T[number]) {
  return z.preprocess((value) => emptyToNull(value) ?? fallback, z.enum(options));
}

/** Array of uuid strings: falsy entries dropped, duplicates removed, capped. */
const uuidList = (max: number) =>
  z
    .preprocess((value) => (Array.isArray(value) ? value.filter(Boolean) : []), z.array(uuidLike).max(max))
    .transform((ids) => Array.from(new Set(ids)));

const optHttpUrl = (max: number) =>
  optText(max).refine((value) => value === null || isHttpUrl(value), "Enter a full link starting with http:// or https://.");

const optDateTime = optText(40).refine(
  (value) => value === null || !Number.isNaN(Date.parse(value)),
  "Enter a valid date and time.",
);

// ---------------------------------------------------------------------------
// POST /api/subjects  (create a subject offering)
// ---------------------------------------------------------------------------

export const teacherAssignmentSchema = z.object({
  teacher_id: uuidLike,
  assignment_role: enumWithDefault(ASSIGNMENT_ROLE_OPTIONS, "teacher"),
  is_primary: boolWithDefault(false),
});

export const createSubjectSchema = z.object({
  existing_subject_id: z.preprocess(
    (value) => {
      const parsed = toNumberOrNull(value);
      return parsed !== null && parsed > 0 ? parsed : null;
    },
    z.number().int("Subject id must be a whole number.").nullable(),
  ),
  class_ids: uuidList(200),
  // The old form sends blank rows; rows without a teacher are dropped, not rejected.
  teacher_assignments: z
    .preprocess(
      (value) =>
        Array.isArray(value)
          ? value.filter((item) => item && typeof item === "object" && (item as { teacher_id?: unknown }).teacher_id)
          : [],
      z.array(teacherAssignmentSchema).max(100),
    )
    // teacher_subjects has one row per teacher+subject+school, so a repeat would fail the upsert.
    .transform((rows) => {
      const seen = new Set<string>();
      return rows.filter((row) => (seen.has(row.teacher_id) ? false : (seen.add(row.teacher_id), true)));
    }),
  subject_name: optText(120),
  subject_code: optText(32),
  acronym: optText(3), // subjects.acronym is varchar(3)
  short_name: optText(60),
  strapline: optText(120), // subjects.strapline is varchar(120)
  description: optText(2000),
  department: optText(80),
  category: enumWithDefault(SUBJECT_CATEGORY_OPTIONS, "core"),
  subject_type: enumWithDefault(SUBJECT_TYPE_OPTIONS, "general"),
  education_level: enumWithDefault(EDUCATION_LEVEL_OPTIONS, "secondary"),
  requires_lab: boolWithDefault(false),
  has_coursework: boolWithDefault(true),
  has_assessments: boolWithDefault(true),
  is_elective: boolWithDefault(false),
  is_active: boolWithDefault(true),
  default_sequence: z.preprocess(toNumberOrNull, z.number().int().min(0).max(100000).nullable()),
  theme_token: optText(32),
  // Either one of the bundled /abstract/ images or a full https URL. Never javascript:/data:.
  abstract_image_url: optText(500).refine(
    (value) => value === null || value.startsWith("/abstract/") || isHttpUrl(value),
    "Background image must be a bundled image or a full https:// link.",
  ),
});
export type CreateSubjectInput = z.output<typeof createSubjectSchema>;

// ---------------------------------------------------------------------------
// POST /api/subjects/[id]/assessments
// ---------------------------------------------------------------------------

const MAX_ASSESSMENT_MARKS = 9999.99; // assessments.total_marks_raw is numeric(6,2)
const MAX_ASSESSMENT_MINUTES = 60 * 24 * 7; // one week; anything longer is a typo

export const createAssessmentSchema = z
  .object({
    type: z.preprocess((value) => emptyToNull(value)?.toLowerCase() ?? null, z.enum(ASSESSMENT_TYPE_OPTIONS).nullable()),
    title: optText(200),
    description: optText(2000),
    term: optText(40),
    // The old form sends 0 when a number box is cleared, and the database rejects 0
    // minutes, so 0 means "not set" here.
    total_marks_raw: z.preprocess(
      (value) => {
        const parsed = toNumberOrNull(value);
        return parsed === 0 ? null : parsed;
      },
      z.number().positive().max(MAX_ASSESSMENT_MARKS).nullable(),
    ),
    duration_minutes: z.preprocess(
      (value) => {
        const parsed = toNumberOrNull(value);
        return parsed === 0 ? null : parsed;
      },
      z.number().int().positive().max(MAX_ASSESSMENT_MINUTES).nullable(),
    ),
    scheduled_start_at: optDateTime,
    scheduled_end_at: optDateTime,
    target_class_ids: uuidList(100),
    teacher_id: optUuid,
  })
  .refine(
    (data) =>
      !data.scheduled_start_at ||
      !data.scheduled_end_at ||
      Date.parse(data.scheduled_end_at) >= Date.parse(data.scheduled_start_at),
    { message: "The end time can't be before the start time.", path: ["scheduled_end_at"] },
  );
export type CreateAssessmentInput = z.output<typeof createAssessmentSchema>;

// ---------------------------------------------------------------------------
// /api/subjects/[id]/coursework  (POST form fields, PATCH JSON, GET query)
// ---------------------------------------------------------------------------

export const COURSEWORK_POST_ACTIONS = ["create_topic", "create_resource"] as const;
export const COURSEWORK_PATCH_ACTIONS = ["toggle_visibility", "update_progress"] as const;

export const createTopicSchema = z.object({
  school_subject_class_id: optUuid,
  title: optText(200),
  parent_id: optUuid,
  node_type: enumWithDefault(CURRICULUM_NODE_TYPE_OPTIONS, "topic"),
  sort_order: z.preprocess((value) => toNumberOrNull(value) ?? 0, z.number().int().min(0).max(100000)),
});
export type CreateTopicInput = z.output<typeof createTopicSchema>;

export const createResourceSchema = z.object({
  school_subject_class_id: optUuid,
  title: optText(200),
  resource_type: enumWithDefault(RESOURCE_TYPE_OPTIONS, "document"),
  visibility: enumWithDefault(RESOURCE_VISIBILITY_OPTIONS, "private"),
  curriculum_node_id: optUuid,
  short_description: optText(1000),
  author_name: optText(120),
  // <img src> only, but keep it to real web links or same-site paths anyway.
  cover_image_url: optText(500).refine(
    (value) => value === null || value.startsWith("/") || isHttpUrl(value),
    "Cover image must be a full https:// link.",
  ),
  // Rendered as <a href> and <iframe src>, so only http(s): a javascript: link here
  // would run script in the admin's browser.
  source_url: optHttpUrl(1000),
});
export type CreateResourceInput = z.output<typeof createResourceSchema>;

export const toggleVisibilitySchema = z.object({
  resource_id: uuidLike,
  next_visibility: z.preprocess(emptyToNull, z.enum(RESOURCE_VISIBILITY_OPTIONS)),
});
export type ToggleVisibilityInput = z.output<typeof toggleVisibilitySchema>;

export const updateProgressSchema = z.object({
  school_subject_class_id: uuidLike,
  current_node_id: optUuid,
  syllabus_progress_pct: z.preprocess(toNumberOrNull, z.number().min(0).max(100).nullable()),
});
export type UpdateProgressInput = z.output<typeof updateProgressSchema>;

/** Optional ?class_offering_id= on GET coursework: only that class's tree + resources come back. */
export const courseworkQuerySchema = z.object({ class_offering_id: optUuid });

// ---------------------------------------------------------------------------
// Upload rules (enforced on the server; the browser check is only a courtesy)
// ---------------------------------------------------------------------------

export const BACKGROUND_MAX_BYTES = SUBJECT_BACKGROUND_MAX_BYTES; // matches the subject_backgrounds bucket limit
export const RESOURCE_MAX_BYTES = SUBJECT_RESOURCE_MAX_BYTES; // matches the subject_resources bucket limit

// image/svg+xml is left out on purpose: SVG can carry script.
const BACKGROUND_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

// Extension -> the content type we store the file with. The extension is also the
// allowlist: anything not listed (html, svg, js, exe, ...) is refused.
export const RESOURCE_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  epub: "application/epub+zip",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

// Browsers label the same file differently (a .csv can arrive as application/vnd.ms-excel,
// a .zip as application/x-zip-compressed), so the declared type is checked against this
// wider list instead of being matched to the extension one-to-one.
const RESOURCE_MIME_TYPES = new Set<string>([
  ...Object.values(RESOURCE_EXTENSIONS),
  "application/x-zip-compressed",
  "application/x-rtf",
  "text/rtf",
  "audio/x-wav",
  "audio/wave",
  "audio/x-m4a",
  "audio/mp3",
  "audio/webm",
  "video/x-m4v",
  "application/ogg",
]);

const GENERIC_TYPES = new Set(["", "application/octet-stream"]);

const MAX_FILE_NAME_LENGTH = 100;

/**
 * Turn any client-supplied file name into a safe storage file name.
 * Why: the name ends up inside a storage path, so it must never carry slashes,
 * dots-only names, control characters or unbounded length.
 */
export function sanitizeFileName(name: string): { safeName: string; extension: string } {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  let safe = base
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[.\-]+/, "");
  if (!safe) safe = "file";

  if (safe.length > MAX_FILE_NAME_LENGTH) {
    const dot = safe.lastIndexOf(".");
    const ext = dot > 0 ? safe.slice(dot) : "";
    safe = safe.slice(0, MAX_FILE_NAME_LENGTH - ext.length) + ext;
  }

  const dot = safe.lastIndexOf(".");
  const extension = dot > 0 ? safe.slice(dot + 1).toLowerCase() : "";
  return { safeName: safe, extension };
}

export type BackgroundCheck = { ok: true; extension: string } | { ok: false; message: string };
export type ResourceFileCheck =
  | { ok: true; safeName: string; contentType: string }
  | { ok: false; message: string };

/** Validate a subject background upload. Messages match what the old route returned. */
export function checkBackgroundImage(file: { type: string; size: number }): BackgroundCheck {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Subject background must be an image file." };
  }
  const extension = BACKGROUND_TYPES[file.type.toLowerCase()];
  if (!extension) {
    return { ok: false, message: "Subject background must be a JPEG, PNG, WebP, GIF or AVIF image." };
  }
  if (file.size > BACKGROUND_MAX_BYTES) {
    return { ok: false, message: "Subject background must be 8MB or smaller." };
  }
  return { ok: true, extension };
}

/** Validate a coursework resource upload (type allowlist, size cap, safe name). */
export function checkResourceFile(file: { name: string; type: string; size: number }): ResourceFileCheck {
  if (file.size > RESOURCE_MAX_BYTES) {
    return { ok: false, message: "Resource file must be 20MB or smaller." };
  }

  const { safeName, extension } = sanitizeFileName(file.name);
  const declared = String(file.type ?? "").toLowerCase().split(";")[0].trim();
  const extensionType = RESOURCE_EXTENSIONS[extension];
  const typeIsAllowed = GENERIC_TYPES.has(declared) || RESOURCE_MIME_TYPES.has(declared);

  if (!extensionType || !typeIsAllowed) {
    return {
      ok: false,
      message: "This file type isn't supported. Upload a PDF, Office/OpenDocument file, text, image, audio, video or ZIP.",
    };
  }

  return { ok: true, safeName, contentType: GENERIC_TYPES.has(declared) ? extensionType : declared };
}

/**
 * Turn a date/time string from the assessment form into a Date.
 * datetime-local inputs send "2026-09-30T09:00" with NO time zone. That has always been
 * stored as UTC (the database default), so a zone-less string is read as UTC here too,
 * whatever time zone the server runs in. Returns null for blank or unreadable input.
 */
export function toDateOrNull(value: string | null | undefined): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const date = new Date(hasZone || isDateOnly ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
