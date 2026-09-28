// =============================================================================
// Self-check for lib/validation/subjects.ts and lib/subjects-directory.ts.
// Run:  pnpm exec tsx lib/validation/subjects.check.ts
// -----------------------------------------------------------------------------
// Pure logic only (no database, no network): request schemas accept what the OLD
// admin forms send and reject what they should, upload rules hold, and the shared
// directory builder computes counts/ranks. Exits non-zero on any failure.
// =============================================================================

import assert from "node:assert/strict";
import {
  RESOURCE_EXTENSIONS,
  RESOURCE_MAX_BYTES,
  BACKGROUND_MAX_BYTES,
  checkBackgroundImage,
  checkResourceFile,
  courseworkQuerySchema,
  createAssessmentSchema,
  createResourceSchema,
  createSubjectSchema,
  createTopicSchema,
  isHttpUrl,
  isUuid,
  sanitizeFileName,
  toggleVisibilitySchema,
  updateProgressSchema,
} from "./subjects";
import { SUBJECT_RESOURCE_ACCEPT } from "../subjects";
import { buildSubjectDirectory } from "../subjects-directory";

let checks = 0;
const failures: string[] = [];

function check(name: string, body: () => void): void {
  checks += 1;
  try {
    body();
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

// ---- ids + urls ------------------------------------------------------------
check("isUuid accepts uuids and rejects junk", () => {
  assert.equal(isUuid(UUID_A), true);
  assert.equal(isUuid("abc"), false);
  assert.equal(isUuid(`${UUID_A}x`), false);
  assert.equal(isUuid(undefined), false);
});

check("isHttpUrl only allows http(s)", () => {
  assert.equal(isHttpUrl("https://youtu.be/x"), true);
  assert.equal(isHttpUrl("http://example.com"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("data:text/html,<script>"), false);
  assert.equal(isHttpUrl("//evil.com"), false);
});

// ---- create subject ---------------------------------------------------------
// What the old slide-over sent (page.tsx handleCreateSubject), before the school was scoped.
const oldForm = {
  existing_subject_id: null,
  school_id: "SOME-OTHER-SCHOOL",
  class_ids: [UUID_A, UUID_A, "", UUID_B],
  subject_name: "  Mathematics ",
  subject_code: "",
  acronym: "MTH",
  short_name: "",
  strapline: "",
  description: "",
  department: "Sciences",
  category: "core",
  subject_type: "general",
  education_level: "secondary",
  requires_lab: false,
  has_coursework: true,
  has_assessments: true,
  is_elective: false,
  is_active: true,
  default_sequence: null,
  theme_token: "amber",
  abstract_image_url: "",
  teacher_assignments: [
    { teacher_id: UUID_C, assignment_role: "hod", is_primary: true },
    { teacher_id: "", assignment_role: "teacher", is_primary: false },
    { teacher_id: UUID_C, assignment_role: "lead", is_primary: false },
  ],
};

check("create subject: the old form payload is accepted and cleaned", () => {
  const parsed = createSubjectSchema.parse(oldForm);
  assert.equal(parsed.subject_name, "Mathematics");
  assert.equal(parsed.subject_code, null);
  assert.deepEqual(parsed.class_ids, [UUID_A, UUID_B]);
  assert.equal(parsed.teacher_assignments.length, 1);
  assert.equal(parsed.teacher_assignments[0].assignment_role, "hod");
  assert.equal(parsed.abstract_image_url, null);
  assert.equal("school_id" in parsed, false, "client school_id must be dropped");
  assert.equal(parsed.existing_subject_id, null);
});

check("create subject: defaults fill in for an empty body", () => {
  const parsed = createSubjectSchema.parse({});
  assert.equal(parsed.category, "core");
  assert.equal(parsed.subject_type, "general");
  assert.equal(parsed.education_level, "secondary");
  assert.equal(parsed.has_coursework, true);
  assert.equal(parsed.has_assessments, true);
  assert.equal(parsed.is_active, true);
  assert.equal(parsed.requires_lab, false);
  assert.deepEqual(parsed.class_ids, []);
});

check("create subject: existing id 0 or blank means 'none'; numbers and numeric strings work", () => {
  assert.equal(createSubjectSchema.parse({ existing_subject_id: 0 }).existing_subject_id, null);
  assert.equal(createSubjectSchema.parse({ existing_subject_id: "" }).existing_subject_id, null);
  assert.equal(createSubjectSchema.parse({ existing_subject_id: "7" }).existing_subject_id, 7);
  assert.equal(createSubjectSchema.parse({ existing_subject_id: 12 }).existing_subject_id, 12);
});

check("create subject: bad values are rejected", () => {
  assert.equal(createSubjectSchema.safeParse({ acronym: "MATH" }).success, false, "acronym is varchar(3)");
  assert.equal(createSubjectSchema.safeParse({ category: "nonsense" }).success, false);
  assert.equal(createSubjectSchema.safeParse({ class_ids: ["not-a-uuid"] }).success, false);
  assert.equal(
    createSubjectSchema.safeParse({ teacher_assignments: [{ teacher_id: "nope" }] }).success,
    false,
  );
  assert.equal(createSubjectSchema.safeParse({ abstract_image_url: "javascript:alert(1)" }).success, false);
  assert.equal(createSubjectSchema.safeParse({ existing_subject_id: 1.5 }).success, false);
  assert.equal(createSubjectSchema.safeParse({ subject_name: "x".repeat(121) }).success, false);
});

check("create subject: bundled and https backgrounds are allowed", () => {
  assert.equal(createSubjectSchema.safeParse({ abstract_image_url: "/abstract/653.jpg" }).success, true);
  assert.equal(createSubjectSchema.safeParse({ abstract_image_url: "https://cdn.example.com/a.jpg" }).success, true);
});

// ---- create assessment ------------------------------------------------------
// What the old detail page sent (handleCreateAssessment).
const oldAssessment = {
  type: "cat",
  title: "Mid-term",
  description: "",
  term: "",
  total_marks_raw: 100,
  duration_minutes: 60,
  scheduled_start_at: "2026-09-30T09:00",
  scheduled_end_at: "2026-09-30T10:00",
  target_class_ids: [UUID_A],
  teacher_id: "",
};

check("assessment: the old form payload is accepted", () => {
  const parsed = createAssessmentSchema.parse(oldAssessment);
  assert.equal(parsed.type, "cat");
  assert.equal(parsed.term, null);
  assert.equal(parsed.teacher_id, null);
  assert.equal(parsed.scheduled_start_at, "2026-09-30T09:00", "raw datetime-local string is kept");
  assert.deepEqual(parsed.target_class_ids, [UUID_A]);
});

check("assessment: a cleared number box (0 / NaN->null / '') means not set", () => {
  const parsed = createAssessmentSchema.parse({ ...oldAssessment, total_marks_raw: 0, duration_minutes: null });
  assert.equal(parsed.total_marks_raw, null);
  assert.equal(parsed.duration_minutes, null);
  assert.equal(createAssessmentSchema.parse({ ...oldAssessment, duration_minutes: "" }).duration_minutes, null);
});

check("assessment: missing required fields are left for the route to report with the old message", () => {
  const parsed = createAssessmentSchema.parse({});
  assert.equal(parsed.title, null);
  assert.equal(parsed.type, null);
  assert.deepEqual(parsed.target_class_ids, []);
});

check("assessment: bad values are rejected", () => {
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, type: "homework" }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, total_marks_raw: -5 }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, total_marks_raw: 100000 }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, duration_minutes: 1.5 }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, target_class_ids: ["x"] }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, teacher_id: "x" }).success, false);
  assert.equal(createAssessmentSchema.safeParse({ ...oldAssessment, scheduled_start_at: "soon" }).success, false);
  assert.equal(
    createAssessmentSchema.safeParse({
      ...oldAssessment,
      scheduled_start_at: "2026-09-30T11:00",
      scheduled_end_at: "2026-09-30T10:00",
    }).success,
    false,
    "end before start",
  );
  assert.equal(
    createAssessmentSchema.safeParse({ ...oldAssessment, scheduled_start_at: "", scheduled_end_at: "2026-09-30T10:00" })
      .success,
    true,
    "an end without a start is fine",
  );
});

check("assessment: created_by from a client is dropped", () => {
  const parsed = createAssessmentSchema.parse({ ...oldAssessment, created_by: UUID_C });
  assert.equal("created_by" in parsed, false);
});

// ---- coursework -------------------------------------------------------------
check("topic: the old form fields (all strings) are accepted", () => {
  const parsed = createTopicSchema.parse({
    school_subject_class_id: UUID_A,
    title: "Quadratic equations",
    node_type: "topic",
    sort_order: "0",
  });
  assert.equal(parsed.sort_order, 0);
  assert.equal(parsed.parent_id, null);
  assert.equal(createTopicSchema.parse({ sort_order: "" }).sort_order, 0);
  assert.equal(createTopicSchema.parse({}).node_type, "topic");
});

check("topic: bad values are rejected", () => {
  assert.equal(createTopicSchema.safeParse({ sort_order: "-1" }).success, false);
  assert.equal(createTopicSchema.safeParse({ sort_order: "1.5" }).success, false);
  assert.equal(createTopicSchema.safeParse({ node_type: "chapter" }).success, false);
  assert.equal(createTopicSchema.safeParse({ parent_id: "nope" }).success, false);
});

check("resource: the old form fields are accepted; blanks become null; defaults apply", () => {
  const parsed = createResourceSchema.parse({
    school_subject_class_id: UUID_A,
    resource_type: "document",
    title: "Worksheet",
    short_description: "",
    author_name: "",
    cover_image_url: "",
    source_url: "",
    visibility: "private",
  });
  assert.equal(parsed.source_url, null);
  assert.equal(parsed.cover_image_url, null);
  assert.equal(parsed.curriculum_node_id, null);
  const defaults = createResourceSchema.parse({});
  assert.equal(defaults.resource_type, "document");
  assert.equal(defaults.visibility, "private");
});

check("resource: script URLs and bad enums are rejected", () => {
  assert.equal(createResourceSchema.safeParse({ source_url: "javascript:alert(1)" }).success, false);
  assert.equal(createResourceSchema.safeParse({ source_url: "data:text/html,x" }).success, false);
  assert.equal(createResourceSchema.safeParse({ source_url: "notaurl" }).success, false);
  assert.equal(createResourceSchema.safeParse({ source_url: "https://www.youtube.com/watch?v=x" }).success, true);
  assert.equal(createResourceSchema.safeParse({ cover_image_url: "javascript:x" }).success, false);
  assert.equal(createResourceSchema.safeParse({ cover_image_url: "/abstract/1.jpg" }).success, true);
  assert.equal(createResourceSchema.safeParse({ resource_type: "podcast" }).success, false);
  assert.equal(createResourceSchema.safeParse({ visibility: "friends" }).success, false);
});

check("visibility toggle + progress update", () => {
  assert.equal(toggleVisibilitySchema.safeParse({ resource_id: UUID_A, next_visibility: "public" }).success, true);
  assert.equal(toggleVisibilitySchema.safeParse({ resource_id: UUID_A, next_visibility: "x" }).success, false);
  assert.equal(toggleVisibilitySchema.safeParse({ resource_id: "nope", next_visibility: "public" }).success, false);

  const ok = updateProgressSchema.parse({ school_subject_class_id: UUID_A, current_node_id: "", syllabus_progress_pct: 42 });
  assert.equal(ok.current_node_id, null);
  assert.equal(ok.syllabus_progress_pct, 42);
  assert.equal(updateProgressSchema.parse({ school_subject_class_id: UUID_A, syllabus_progress_pct: "" }).syllabus_progress_pct, null);
  assert.equal(updateProgressSchema.safeParse({ school_subject_class_id: UUID_A, syllabus_progress_pct: 150 }).success, false);
  assert.equal(updateProgressSchema.safeParse({ school_subject_class_id: UUID_A, syllabus_progress_pct: -1 }).success, false);
});

check("coursework query: class_offering_id is optional and must be a uuid", () => {
  assert.equal(courseworkQuerySchema.parse({ class_offering_id: null }).class_offering_id, null);
  assert.equal(courseworkQuerySchema.parse({}).class_offering_id, null);
  assert.equal(courseworkQuerySchema.parse({ class_offering_id: UUID_A }).class_offering_id, UUID_A);
  assert.equal(courseworkQuerySchema.safeParse({ class_offering_id: "nope" }).success, false);
});

// ---- uploads ----------------------------------------------------------------
check("sanitizeFileName strips paths, odd characters and dot tricks", () => {
  assert.equal(sanitizeFileName("../../etc/passwd").safeName, "passwd");
  assert.equal(sanitizeFileName("C:\\Users\\me\\Worksheet 1.PDF").safeName, "Worksheet-1.PDF");
  assert.equal(sanitizeFileName("Worksheet 1.PDF").extension, "pdf");
  assert.equal(sanitizeFileName("...hidden").safeName, "hidden");
  assert.equal(sanitizeFileName("").safeName, "file");
  assert.equal(sanitizeFileName("a..b.pdf").safeName, "a.b.pdf");
  const long = sanitizeFileName(`${"x".repeat(300)}.pdf`);
  assert.equal(long.safeName.length, 100);
  assert.equal(long.extension, "pdf");
});

check("resource upload: allowed types pass, dangerous ones are refused", () => {
  const ok = checkResourceFile({ name: "Notes 1.pdf", type: "application/pdf", size: 1000 });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.safeName, "Notes-1.pdf");

  // Browsers send octet-stream for unknown types: the extension decides, and the stored type is ours.
  const generic = checkResourceFile({ name: "deck.pptx", type: "application/octet-stream", size: 10 });
  assert.equal(generic.ok, true);
  if (generic.ok) assert.equal(generic.contentType, "application/vnd.openxmlformats-officedocument.presentationml.presentation");

  assert.equal(checkResourceFile({ name: "x.zip", type: "application/x-zip-compressed", size: 10 }).ok, true);
  assert.equal(checkResourceFile({ name: "x.csv", type: "application/vnd.ms-excel", size: 10 }).ok, true, "Windows labels csv as excel");
  assert.equal(checkResourceFile({ name: "clip.mp4", type: "video/mp4", size: 10 }).ok, true);

  assert.equal(checkResourceFile({ name: "page.html", type: "text/html", size: 10 }).ok, false);
  assert.equal(checkResourceFile({ name: "page.html", type: "application/pdf", size: 10 }).ok, false, "type spoof");
  assert.equal(checkResourceFile({ name: "logo.svg", type: "image/svg+xml", size: 10 }).ok, false);
  assert.equal(checkResourceFile({ name: "run.exe", type: "application/octet-stream", size: 10 }).ok, false);
  assert.equal(checkResourceFile({ name: "script.js", type: "text/javascript", size: 10 }).ok, false);
  assert.equal(checkResourceFile({ name: "noextension", type: "application/pdf", size: 10 }).ok, false);
  assert.equal(checkResourceFile({ name: "evil.pdf.html", type: "application/pdf", size: 10 }).ok, false);
});

check("resource upload: size cap is 20MB", () => {
  assert.equal(checkResourceFile({ name: "a.pdf", type: "application/pdf", size: RESOURCE_MAX_BYTES }).ok, true);
  const tooBig = checkResourceFile({ name: "a.pdf", type: "application/pdf", size: RESOURCE_MAX_BYTES + 1 });
  assert.equal(tooBig.ok, false);
});

check("background upload: image types only, 8MB cap, old messages kept", () => {
  const png = checkBackgroundImage({ type: "image/png", size: 1000 });
  assert.equal(png.ok, true);
  if (png.ok) assert.equal(png.extension, "png");

  const notImage = checkBackgroundImage({ type: "application/pdf", size: 10 });
  assert.equal(notImage.ok, false);
  if (!notImage.ok) assert.equal(notImage.message, "Subject background must be an image file.");

  assert.equal(checkBackgroundImage({ type: "image/svg+xml", size: 10 }).ok, false);

  const big = checkBackgroundImage({ type: "image/jpeg", size: BACKGROUND_MAX_BYTES + 1 });
  assert.equal(big.ok, false);
  if (!big.ok) assert.equal(big.message, "Subject background must be 8MB or smaller.");
});

check("the UI's accept string and the server's extension allowlist agree", () => {
  const accepted = SUBJECT_RESOURCE_ACCEPT.split(",").map((item) => item.replace(/^\./, "")).sort();
  assert.deepEqual(accepted, Object.keys(RESOURCE_EXTENSIONS).sort());
});

// ---- directory builder (shared by the Supabase and Prisma paths) ----------------
check("directory builder: counts, teachers, classes and rank for one school", () => {
  const subjectBase = {
    subject_code: null, acronym: null, short_name: null, strapline: null, description: null,
    department: "Sciences", category: "core", subject_type: "general", education_level: "secondary",
    requires_lab: false, has_coursework: true, has_assessments: true, is_elective: false,
    is_active: true, default_sequence: null, theme_token: null, abstract_image_url: null,
  };
  const payload = buildSubjectDirectory({
    options: { schools: [{ id: "s1", name: "School One" }], classes: [], teachers: [], masterSubjects: [] },
    offerings: [
      { id: "o-math", school_id: "s1", subject_id: 1, created_at: null },
      { id: "o-eng", school_id: "s1", subject_id: 2, created_at: null },
    ],
    subjects: [
      { id: 1, subject_name: "Mathematics", ...subjectBase },
      { id: 2, subject_name: "English", ...subjectBase, department: "Languages" },
    ],
    schools: [{ id: "s1", name: "School One" }],
    classes: [{ id: "c1", school_id: "s1", class_name: "Form 1", stream: "A" }],
    schoolSubjectClasses: [{ id: "ssc1", school_subject_id: "o-math", class_id: "c1", display_order: 0 }],
    teacherSubjects: [
      { id: "t1", teacher_id: "tea1", subject_id: 1, school_id: "s1", is_primary: true, school_subject_id: "o-math", assignment_role: "hod" },
    ],
    teachers: [{ id: "tea1", school_id: "s1", name: "Ms Wanjiru", email: null, phone: null, profile_photo: null }],
    studentSubjects: [
      { student_id: "st1", subject_id: 1, teacher_id: null, school_subject_id: "o-math", school_id: "s1", is_active: true },
      { student_id: "st2", subject_id: 1, teacher_id: null, school_subject_id: null, school_id: "s1", is_active: true },
      { student_id: "st3", subject_id: 1, teacher_id: null, school_subject_id: "o-math", school_id: "s1", is_active: false },
    ],
    gradingReports: [
      { subject_id: 1, term: "Term 1", class_id: "c1", created_at: "2026-01-02", school_subject_id: "o-math", raw_score: null, normalized_pct: 80 },
      { subject_id: 2, term: "Term 1", class_id: "c1", created_at: "2026-01-02", school_subject_id: null, raw_score: null, normalized_pct: 60 },
    ],
    classPerformance: [],
  });

  assert.deepEqual(payload.options.departments, ["Languages", "Sciences"]);
  assert.equal(payload.cards.length, 2);
  const math = payload.cards.find((card) => card.title === "Mathematics");
  const english = payload.cards.find((card) => card.title === "English");
  assert.ok(math && english);
  assert.equal(math.totalStudents, 2, "inactive enrolment not counted; legacy row without school_subject_id matched by subject+school");
  assert.equal(math.totalTeachers, 1);
  assert.equal(math.averageScore, 80);
  assert.equal(math.schoolRank, 1);
  assert.equal(english.schoolRank, 2, "English resolved to its offering through subject+school");
  assert.deepEqual(math.classes, [{ id: "c1", label: "Form 1 A" }]);
  assert.equal(payload.cards[0].title, "Mathematics", "highest average first");
  assert.equal(math.strapline, "Structured academic growth hub");
});

if (failures.length > 0) {
  console.error(`FAILED ${failures.length}/${checks} checks:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`OK: ${checks} checks passed.`);
