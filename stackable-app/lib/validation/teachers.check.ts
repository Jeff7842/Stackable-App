// =============================================================================
// Self-check for the teacher admin logic. Run:  pnpm exec tsx lib/validation/teachers.check.ts
// -----------------------------------------------------------------------------
// No framework, no database, no network. Covers: time/timetable helpers, the zod
// schemas, the row -> DTO mappers (Date/BigInt-typed and plain string-typed rows must give
// IDENTICAL JSON), the photo sniffing rules, and every business rule in
// teacher-admin.service.ts through an in-memory fake store. Exits non-zero on failure.
// =============================================================================

import assert from "node:assert/strict";
import { ApiError } from "@/lib/api/errors";
import { __setRedisForTests } from "@/lib/cache";
import { averagePointsFromCounts, gradeToPoints } from "@/lib/grade-points";
import { toEditData, toTimetableSlot, diffTeacherSubjects, toAttendanceData, type TeacherRaw } from "@/lib/mappers/teacher-admin.mapper";
import { managedPhotoPath, parsePhotoPath, sniffImageType } from "@/lib/teacher-photo";
import { findTimetableConflicts, normalizeTime, sortTimetable } from "@/lib/timetable";
import { createTeacher, deleteTeacher, isUniqueViolation, saveTimetable, updateTeacher, type PhotoStorage } from "@/lib/services/teacher-admin.service";
import type {
  ClassRef,
  TeacherAdminStore,
  TeacherCreatePlan,
  TeacherRow,
  TeacherWritePlan,
} from "@/lib/services/teacher-admin.store";
import {
  readTeacherCreateRequest,
  teacherCreateSchema,
  teacherUpdateSchema,
  timetableSaveSchema,
  timetableSlotSchema,
  type TeacherCreateParsed,
  type TeacherUpdateParsed,
} from "@/lib/validation/teachers";
import type { TeacherListItem, TimetableWriteRow } from "@/lib/dto/teachers";

let checks = 0;
const failures: string[] = [];

async function check(name: string, body: () => Promise<void> | void): Promise<void> {
  checks += 1;
  try {
    await body();
  } catch (err) {
    failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Assert that a promise rejects with an ApiError of the given status (and code). */
async function rejectsWith(promise: Promise<unknown>, status: number, code?: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${String(err)}`);
    assert.equal(err.status, status, `status ${err.status}: ${err.message}`);
    if (code) assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected a ${status} rejection`);
}

__setRedisForTests(null); // no Redis: cached() just runs the function, bumpCache() is a no-op

// ---- fake store + fake photo storage ------------------------------------------

const SCHOOL = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "99999999-9999-9999-9999-999999999999";
const TEACHER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_TEACHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CLASS_A = "c1111111-1111-1111-1111-111111111111"; // free
const CLASS_B = "c2222222-2222-2222-2222-222222222222"; // led by OTHER_TEACHER
const FOREIGN_CLASS = "c3333333-3333-3333-3333-333333333333"; // belongs to another school

type FakeState = {
  teacher: TeacherRow | null;
  takenEmail: boolean;
  takenAdmission: boolean;
  classes: ClassRef[];
  subjectIds: number[];
  gradingReports: number;
  failApply: boolean;
  failCreate: boolean;
  applied: TeacherWritePlan[];
  created: TeacherCreatePlan[];
  replaced: TimetableWriteRow[][];
  deleted: string[];
};

function makeTeacher(overrides: Partial<TeacherRow> = {}): TeacherRow {
  return {
    id: TEACHER,
    school_id: SCHOOL,
    name: "Jane Doe",
    email: "jane@school.test",
    phone: "0700000000",
    admission_number: "T-001",
    subject_id: 1,
    profile_photo: `/api/teachers/photo?path=${encodeURIComponent(`teachers/${TEACHER}/old.jpg`)}`,
    status: "active",
    class_teacher: true,
    ...overrides,
  };
}

function makeStore(state: FakeState): TeacherAdminStore {
  const listItem: TeacherListItem = {
    id: TEACHER, name: "Jane Doe", email: "jane@school.test", phone: null, admission_number: "T-001", subject_id: 1,
    school_id: SCHOOL, profile_photo: null, status: "active", created_at: null, days_present: 0, total_school_days: 70,
    attendance_percentage: null, class_teacher: true, school_name: "S", subject_name: "Maths", class_labels: [],
  };
  return {
    listTeachers: async () => [],
    getProfile: async () => null,
    getFormOptions: async () => ({ schools: [], classes: [], subjects: [] }),
    teacherExists: async (schoolId, id) => state.teacher?.school_id === schoolId && state.teacher.id === id,
    findCreateContext: async (schoolId, classId, subjectId) => ({
      school: schoolId === SCHOOL ? { id: SCHOOL, name: "Green Academy" } : null,
      klass: state.classes.find((item) => item.id === classId && item.school_id === schoolId) ?? null,
      subject: state.subjectIds.includes(subjectId) ? { id: subjectId, subject_name: `Subject ${subjectId}` } : null,
    }),
    createTeacher: async (plan) => {
      if (state.failCreate) throw new Error("database exploded");
      state.created.push(plan);
    },
    getTeacherRow: async (schoolId, id) => (state.teacher && state.teacher.school_id === schoolId && state.teacher.id === id ? state.teacher : null),
    getTeacherListItem: async () => listItem,
    getEditData: async () => null,
    getTimetable: async (schoolId, id) =>
      state.teacher && state.teacher.school_id === schoolId && state.teacher.id === id
        ? { teacher: { id, name: "Jane", email: null, phone: null, admission_number: "T", profile_photo: null, status: "active", class_teacher: true }, slots: [], classes: [], subjects: [] }
        : null,
    getAttendance: async () => null,
    findIdentityConflicts: async () => ({ email: state.takenEmail, admission_number: state.takenAdmission }),
    listClasses: async (schoolId) => state.classes.filter((item) => item.school_id === schoolId),
    findSubjects: async (ids) => ids.filter((id) => state.subjectIds.includes(id)).map((id) => ({ id, subject_name: `S${id}` })),
    applyUpdate: async (plan) => {
      if (state.failApply) throw new Error("database exploded");
      state.applied.push(plan);
    },
    replaceTimetable: async (_schoolId, _teacherId, slots) => {
      state.replaced.push(slots);
    },
    countGradingReports: async () => state.gradingReports,
    deleteTeacher: async (schoolId, id) => {
      if (!state.teacher || state.teacher.school_id !== schoolId || state.teacher.id !== id) return false;
      state.deleted.push(id);
      return true;
    },
  };
}

function freshState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    teacher: makeTeacher(),
    takenEmail: false,
    takenAdmission: false,
    classes: [
      { id: CLASS_A, school_id: SCHOOL, class_name: "Grade 7", stream: "A", class_teacher_id: null },
      { id: CLASS_B, school_id: SCHOOL, class_name: "Grade 8", stream: "B", class_teacher_id: OTHER_TEACHER },
      { id: FOREIGN_CLASS, school_id: OTHER_SCHOOL, class_name: "Grade 1", stream: null, class_teacher_id: null },
    ],
    subjectIds: [1, 2, 3],
    gradingReports: 0,
    failApply: false,
    failCreate: false,
    applied: [],
    created: [],
    replaced: [],
    deleted: [],
    ...overrides,
  };
}

function makePhotos() {
  const log = { uploaded: [] as string[], removed: [] as Array<string | null> };
  const photos: PhotoStorage = {
    upload: async (teacherId) => {
      const path = `teachers/${teacherId}/new.png`;
      log.uploaded.push(path);
      return { path, url: `/api/teachers/photo?path=${encodeURIComponent(path)}` };
    },
    remove: async (path) => {
      log.removed.push(path);
    },
    pathFromUrl: managedPhotoPath,
  };
  return { photos, log };
}

const fakeFile = () => new File([new Uint8Array(20)], "x.png", { type: "image/png" });
const parseUpdate = (input: unknown): TeacherUpdateParsed => teacherUpdateSchema.parse(input);
const noPhotos = makePhotos().photos;

async function main(): Promise<void> {
  // ---- time + timetable helpers -------------------------------------------------
  await check("normalizeTime accepts the shapes Postgres and <input type=time> produce", () => {
    assert.equal(normalizeTime("8:00"), "08:00");
    assert.equal(normalizeTime("08:00"), "08:00");
    assert.equal(normalizeTime("08:30:00"), "08:30");
    assert.equal(normalizeTime("08:30:00.000000"), "08:30");
    assert.equal(normalizeTime(new Date("1970-01-01T14:05:00.000Z")), "14:05");
    assert.equal(normalizeTime("24:00"), null);
    assert.equal(normalizeTime("12:60"), null);
    assert.equal(normalizeTime("noon"), null);
    assert.equal(normalizeTime(null), null);
  });

  await check("findTimetableConflicts: overlap yes, back-to-back no, other day no", () => {
    const slots = [
      { day_of_week: "monday", start_time: "08:00", end_time: "09:00" },
      { day_of_week: "monday", start_time: "08:30", end_time: "09:30" }, // overlaps #0
      { day_of_week: "monday", start_time: "09:00", end_time: "10:00" }, // touches #0, overlaps #1
      { day_of_week: "tuesday", start_time: "08:00", end_time: "09:00" }, // other day
    ];
    const conflicts = findTimetableConflicts(slots);
    assert.deepEqual(conflicts.map((c) => [c.first_index, c.second_index]), [[0, 1], [1, 2]]);
    assert.match(conflicts[0].message, /Monday: 08:00-09:00 overlaps 08:30-09:30/);
    assert.deepEqual(findTimetableConflicts([]), []);
  });

  await check("sortTimetable orders Monday->Sunday then by start time, unknown days last", () => {
    const sorted = sortTimetable([
      { day_of_week: "friday", start_time: "08:00" },
      { day_of_week: "monday", start_time: "10:00" },
      { day_of_week: "monday", start_time: "08:00" },
      { day_of_week: "someday", start_time: "07:00" },
    ]);
    assert.deepEqual(sorted.map((s) => `${s.day_of_week}@${s.start_time}`), ["monday@08:00", "monday@10:00", "friday@08:00", "someday@07:00"]);
  });

  // ---- zod schemas --------------------------------------------------------------
  await check("timetable slot: class block keeps class/subject, drops title; normalises day and times", () => {
    const slot = timetableSlotSchema.parse({ day_of_week: " Monday ", start_time: "8:00", end_time: "09:00:00", class_id: CLASS_A, subject_id: 2, title: "ignored", room: "  " });
    assert.deepEqual(slot, { class_id: CLASS_A, subject_id: 2, day_of_week: "monday", start_time: "08:00", end_time: "09:00", room: null, item_type: "class", title: null, notes: null });
  });

  await check("timetable slot: duty block keeps title, drops class/subject", () => {
    const slot = timetableSlotSchema.parse({ item_type: "duty", title: "Assembly", class_id: CLASS_A, subject_id: 1, day_of_week: "friday", start_time: "07:00", end_time: "07:30" });
    assert.equal(slot.class_id, null);
    assert.equal(slot.subject_id, null);
    assert.equal(slot.title, "Assembly");
  });

  await check("timetable slot: rejects end<=start, bad day, bad time, bad class id", () => {
    assert.equal(timetableSlotSchema.safeParse({ day_of_week: "monday", start_time: "09:00", end_time: "09:00" }).success, false);
    assert.equal(timetableSlotSchema.safeParse({ day_of_week: "monday", start_time: "10:00", end_time: "09:00" }).success, false);
    assert.equal(timetableSlotSchema.safeParse({ day_of_week: "funday", start_time: "08:00", end_time: "09:00" }).success, false);
    assert.equal(timetableSlotSchema.safeParse({ day_of_week: "monday", start_time: "8am", end_time: "09:00" }).success, false);
    assert.equal(timetableSlotSchema.safeParse({ day_of_week: "monday", start_time: "08:00", end_time: "09:00", class_id: "not-a-uuid" }).success, false);
  });

  await check("timetable save: caps the number of slots", () => {
    const slot = { day_of_week: "monday", start_time: "08:00", end_time: "09:00" };
    assert.equal(timetableSaveSchema.safeParse({ slots: Array.from({ length: 100 }, () => slot) }).success, true);
    assert.equal(timetableSaveSchema.safeParse({ slots: Array.from({ length: 101 }, () => slot) }).success, false);
  });

  await check("teacher update: empty body rejected, unknown keys stripped (no school_id)", () => {
    assert.equal(teacherUpdateSchema.safeParse({}).success, false);
    const parsed = teacherUpdateSchema.parse({ name: "  New Name ", school_id: OTHER_SCHOOL, sneaky: true });
    assert.deepEqual(parsed, { name: "New Name" });
  });

  await check("teacher update: email/status/phone rules, subject ids de-duplicated in order", () => {
    assert.equal(teacherUpdateSchema.safeParse({ email: "nope" }).success, false);
    assert.equal(teacherUpdateSchema.safeParse({ status: "fired" }).success, false);
    assert.equal(teacherUpdateSchema.parse({ email: " a@b.co " }).email, "a@b.co");
    assert.equal(teacherUpdateSchema.parse({ phone: "  " }).phone, null);
    assert.deepEqual(teacherUpdateSchema.parse({ subject_ids: [3, 1, 3, 2, 1] }).subject_ids, [3, 1, 2]);
    assert.equal(teacherUpdateSchema.safeParse({ subject_ids: [0] }).success, false);
    assert.equal(teacherUpdateSchema.parse({ class_teacher_class_id: null }).class_teacher_class_id, null);
    assert.equal(teacherUpdateSchema.safeParse({ class_teacher_class_id: "x" }).success, false);
  });

  // ---- grade points, subject diff, mappers --------------------------------------
  await check("grade points: scale matches scoreToGrade and ignores unknown letters", () => {
    assert.equal(gradeToPoints("a"), 12);
    assert.equal(gradeToPoints("F"), 1);
    assert.equal(gradeToPoints("A-"), null);
    assert.equal(averagePointsFromCounts([{ grade: "A", count: 1 }, { grade: "B", count: 1 }]), 11);
    assert.equal(averagePointsFromCounts([{ grade: "A-", count: 3 }]), null);
    assert.equal(averagePointsFromCounts([]), null);
  });

  await check("diffTeacherSubjects keeps rows that stay, first id is primary", () => {
    const diff = diffTeacherSubjects([{ subject_id: 1 }, { subject_id: 2 }], [3, 2]);
    assert.deepEqual(diff, { toDelete: [1], toInsert: [3], primary: 3 });
    assert.deepEqual(diffTeacherSubjects([{ subject_id: 1 }], []), { toDelete: [1], toInsert: [], primary: null });
  });

  const prismaTeacher: TeacherRaw = {
    id: TEACHER, name: "Jane", email: "j@s.test", phone: null, admission_number: "T-1", subject_id: BigInt("2"), school_id: SCHOOL,
    profile_photo: null, status: "active", created_at: new Date("2026-01-05T10:00:00.000Z"), days_present: 3, total_school_days: 70,
    attendance_percentage: 4.29, class_teacher: true,
  };
  const stringTeacher: TeacherRaw = { ...prismaTeacher, subject_id: 2, created_at: "2026-01-05T10:00:00+00:00", attendance_percentage: "4.29" };
  const classRows = [
    { id: CLASS_A, school_id: SCHOOL, class_name: "Grade 10", stream: null, class_teacher_id: TEACHER },
    { id: CLASS_B, school_id: SCHOOL, class_name: "Grade 2", stream: "A", class_teacher_id: null },
  ];

  await check("edit data: identical JSON from Date/BigInt-typed and plain string-typed rows", () => {
    const prismaJson = toEditData({
      teacher: prismaTeacher, schoolName: "S", subjects: [{ id: BigInt("2"), subject_name: "Math" }, { id: BigInt("1"), subject_name: "Art" }],
      classes: classRows, bridgeSubjectIds: [BigInt("1"), BigInt("2")],
      timetable: [
        { id: "t2", teacher_id: TEACHER, class_id: CLASS_B, subject_id: BigInt("2"), day_of_week: "Tuesday", start_time: new Date("1970-01-01T08:00:00Z"), end_time: new Date("1970-01-01T09:00:00Z"), room: null, item_type: null, title: null, notes: null, created_at: new Date("2026-01-05T10:00:00Z") },
        { id: "t1", teacher_id: TEACHER, class_id: CLASS_A, subject_id: 1, day_of_week: "monday", start_time: new Date("1970-01-01T07:00:00Z"), end_time: new Date("1970-01-01T08:00:00Z"), room: "R1", item_type: "class", title: null, notes: null, created_at: new Date("2026-01-05T10:00:00Z") },
      ],
    });
    const stringJson = toEditData({
      teacher: stringTeacher, schoolName: "S", subjects: [{ id: 2, subject_name: "Math" }, { id: 1, subject_name: "Art" }],
      classes: classRows, bridgeSubjectIds: [1, 2],
      timetable: [
        { id: "t2", teacher_id: TEACHER, class_id: CLASS_B, subject_id: 2, day_of_week: "Tuesday", start_time: "08:00:00", end_time: "09:00:00", room: null, item_type: null, title: null, notes: null, created_at: "2026-01-05T10:00:00+00:00" },
        { id: "t1", teacher_id: TEACHER, class_id: CLASS_A, subject_id: 1, day_of_week: "monday", start_time: "07:00:00", end_time: "08:00:00", room: "R1", item_type: "class", title: null, notes: null, created_at: "2026-01-05T10:00:00+00:00" },
      ],
    });
    assert.deepEqual(JSON.parse(JSON.stringify(prismaJson)), JSON.parse(JSON.stringify(stringJson)));
    assert.deepEqual(prismaJson.assigned_subject_ids, [2, 1]); // primary (2) first, then the rest
    assert.equal(prismaJson.class_teacher_class_id, CLASS_A);
    assert.deepEqual(prismaJson.timetable.map((s) => s.id), ["t1", "t2"]); // Monday before Tuesday
    assert.equal(prismaJson.timetable[1].item_type, "class"); // null item_type -> "class"
    assert.deepEqual(prismaJson.classes.map((c) => c.label), ["Grade 2 A", "Grade 10"]); // numeric-aware A-Z
    assert.deepEqual(prismaJson.subjects.map((s) => s.subject_name), ["Art", "Math"]);
  });

  await check("timetable slot mapper turns a Time Date and a time string into the same HH:MM", () => {
    const a = toTimetableSlot({ id: "x", teacher_id: TEACHER, class_id: null, subject_id: null, day_of_week: "MONDAY", start_time: new Date("1970-01-01T13:15:00Z"), end_time: "14:00:00", room: null, item_type: "event", title: "T", notes: null, created_at: null });
    assert.equal(a.start_time, "13:15");
    assert.equal(a.end_time, "14:00");
    assert.equal(a.day_of_week, "monday");
  });

  await check("attendance mapper: summary counts ALL records, records capped, truncated flag", () => {
    const data = toAttendanceData({
      teacher: prismaTeacher, subjectName: "Math",
      groups: [{ status: "present", count: 5 }, { status: "late", count: 2 }, { status: "absent", count: 1 }],
      records: [{ id: "r1", reference_code: "A", clock_in: new Date("2026-01-05T08:00:00Z"), clock_out: null, status: "present", remarks: null, created_at: "2026-01-05T08:00:00Z" }],
      limit: 1,
    });
    assert.deepEqual(data.summary, { total: 8, present: 5, late: 2, absent: 1 });
    assert.equal(data.truncated, true);
    assert.equal(data.records[0].clock_in, "2026-01-05T08:00:00.000Z");
  });

  // ---- photo rules --------------------------------------------------------------
  await check("sniffImageType trusts bytes, not the claimed type", () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    assert.equal(sniffImageType(png)?.ext, "png");
    assert.equal(sniffImageType(jpg)?.mime, "image/jpeg");
    assert.equal(sniffImageType(gif)?.ext, "gif");
    assert.equal(sniffImageType(webp)?.ext, "webp");
    assert.equal(sniffImageType(svg), null);
    assert.equal(sniffImageType(new Uint8Array(3)), null);
  });

  await check("managedPhotoPath only accepts this teacher's own storage paths", () => {
    const own = `/api/teachers/photo?path=${encodeURIComponent(`teachers/${TEACHER}/a.jpg`)}`;
    assert.equal(managedPhotoPath(own, TEACHER), `teachers/${TEACHER}/a.jpg`);
    assert.equal(managedPhotoPath(own, OTHER_TEACHER), null);
    assert.equal(managedPhotoPath("https://cdn.example.com/x.jpg", TEACHER), null);
    assert.equal(managedPhotoPath(`/api/teachers/photo?path=${encodeURIComponent(`teachers/${TEACHER}/../x.jpg`)}`, TEACHER), null);
    assert.equal(managedPhotoPath(null, TEACHER), null);
  });

  // ---- service rules ------------------------------------------------------------
  await check("update: teacher of another school is a 404 and nothing is written", async () => {
    const state = freshState();
    await rejectsWith(updateTeacher(makeStore(state), noPhotos, OTHER_SCHOOL, TEACHER, parseUpdate({ name: "Hacked" }), null), 404);
    assert.equal(state.applied.length, 0);
  });

  await check("update: email / teacher ID already used by another teacher is a 409 with a code", async () => {
    const taken = freshState({ takenEmail: true });
    await rejectsWith(updateTeacher(makeStore(taken), noPhotos, SCHOOL, TEACHER, parseUpdate({ email: "x@y.co" }), null), 409, "TEACHER_EMAIL_TAKEN");
    const adm = freshState({ takenAdmission: true });
    await rejectsWith(updateTeacher(makeStore(adm), noPhotos, SCHOOL, TEACHER, parseUpdate({ admission_number: "T-2" }), null), 409, "TEACHER_ID_TAKEN");
  });

  await check("update: unchanged email does not trigger the duplicate lookup", async () => {
    const state = freshState({ takenEmail: true });
    const result = await updateTeacher(makeStore(state), noPhotos, SCHOOL, TEACHER, parseUpdate({ email: "jane@school.test", name: "J" }), null);
    assert.equal(result.id, TEACHER);
    assert.equal(state.applied.length, 1);
  });

  await check("update: class ownership rules (foreign class 400, taken class 409, off-flag 400, own class ok)", async () => {
    await rejectsWith(updateTeacher(makeStore(freshState()), noPhotos, SCHOOL, TEACHER, parseUpdate({ class_teacher_class_id: FOREIGN_CLASS }), null), 400);
    await rejectsWith(updateTeacher(makeStore(freshState()), noPhotos, SCHOOL, TEACHER, parseUpdate({ class_teacher_class_id: CLASS_B }), null), 409, "CLASS_TEACHER_TAKEN");
    const off = freshState({ teacher: makeTeacher({ class_teacher: false }) });
    await rejectsWith(updateTeacher(makeStore(off), noPhotos, SCHOOL, TEACHER, parseUpdate({ class_teacher_class_id: CLASS_A }), null), 400);
    const ok = freshState();
    await updateTeacher(makeStore(ok), noPhotos, SCHOOL, TEACHER, parseUpdate({ class_teacher_class_id: CLASS_A }), null);
    assert.equal(ok.applied[0].classOwnership, CLASS_A);
  });

  await check("update: turning class teacher off releases every class", async () => {
    const state = freshState();
    await updateTeacher(makeStore(state), noPhotos, SCHOOL, TEACHER, parseUpdate({ class_teacher: false }), null);
    assert.equal(state.applied[0].classOwnership, null);
    assert.equal(state.applied[0].fields.class_teacher, false);
  });

  await check("update: subjects - unknown id is 400, first id becomes the primary subject", async () => {
    await rejectsWith(updateTeacher(makeStore(freshState()), noPhotos, SCHOOL, TEACHER, parseUpdate({ subject_ids: [1, 99] }), null), 400);
    const state = freshState();
    await updateTeacher(makeStore(state), noPhotos, SCHOOL, TEACHER, parseUpdate({ subject_ids: [3, 1] }), null);
    assert.equal(state.applied[0].fields.subject_id, 3);
    assert.deepEqual(state.applied[0].subjectIds, [3, 1]);
    const cleared = freshState();
    await updateTeacher(makeStore(cleared), noPhotos, SCHOOL, TEACHER, parseUpdate({ subject_ids: [] }), null);
    assert.equal(cleared.applied[0].fields.subject_id, null);
  });

  await check("update: timetable must use this school's classes and real subjects; overlaps are reported, not blocking", async () => {
    const slot = (over: Record<string, unknown>) => ({ day_of_week: "monday", start_time: "08:00", end_time: "09:00", class_id: CLASS_A, subject_id: 1, ...over });
    await rejectsWith(updateTeacher(makeStore(freshState()), noPhotos, SCHOOL, TEACHER, parseUpdate({ timetable: [slot({ class_id: FOREIGN_CLASS })] }), null), 400);
    await rejectsWith(updateTeacher(makeStore(freshState()), noPhotos, SCHOOL, TEACHER, parseUpdate({ timetable: [slot({ subject_id: 42 })] }), null), 400);
    const state = freshState();
    const result = await updateTeacher(makeStore(state), noPhotos, SCHOOL, TEACHER, parseUpdate({ timetable: [slot({}), slot({ start_time: "08:30", end_time: "09:30" })] }), null);
    assert.equal(state.applied[0].timetable?.length, 2);
    assert.equal(result.timetable_conflicts.length, 1);
  });

  await check("update: new photo is stored, row points at it, OLD photo removed only after success", async () => {
    const { photos, log } = makePhotos();
    const state = freshState();
    await updateTeacher(makeStore(state), photos, SCHOOL, TEACHER, parseUpdate({ remove_photo: false }), fakeFile());
    assert.deepEqual(log.uploaded, [`teachers/${TEACHER}/new.png`]);
    assert.match(String(state.applied[0].fields.profile_photo), /new\.png/);
    assert.deepEqual(log.removed, [`teachers/${TEACHER}/old.jpg`]);
  });

  await check("update: when the database write fails the NEW photo is removed and the old one kept", async () => {
    const { photos, log } = makePhotos();
    const state = freshState({ failApply: true });
    await assert.rejects(updateTeacher(makeStore(state), photos, SCHOOL, TEACHER, parseUpdate({ name: "X" }), fakeFile()), /database exploded/);
    assert.deepEqual(log.removed, [`teachers/${TEACHER}/new.png`]);
  });

  await check("update: a unique-constraint failure from the database becomes a 409 (and the new photo is cleaned up)", async () => {
    const { photos, log } = makePhotos();
    const state = freshState({ failApply: true });
    const store = makeStore(state);
    store.applyUpdate = async () => {
      throw Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), { code: "P2002" });
    };
    await rejectsWith(updateTeacher(store, photos, SCHOOL, TEACHER, parseUpdate({ name: "X" }), fakeFile()), 409, "TEACHER_IDENTITY_TAKEN");
    assert.deepEqual(log.removed, [`teachers/${TEACHER}/new.png`]);
    assert.equal(isUniqueViolation(new Error('duplicate key value violates unique constraint "teachers_email_key"')), true);
    assert.equal(isUniqueViolation(new Error("network down")), false);
  });

  await check("update: remove_photo clears the column and deletes the stored file", async () => {
    const { photos, log } = makePhotos();
    const state = freshState();
    await updateTeacher(makeStore(state), photos, SCHOOL, TEACHER, parseUpdate({ remove_photo: true }), null);
    assert.equal(state.applied[0].fields.profile_photo, null);
    assert.deepEqual(log.removed, [`teachers/${TEACHER}/old.jpg`]);
  });

  await check("update: a rejected form uploads nothing", async () => {
    const { photos, log } = makePhotos();
    await rejectsWith(updateTeacher(makeStore(freshState()), photos, SCHOOL, TEACHER, parseUpdate({ class_teacher_class_id: CLASS_B }), fakeFile()), 409);
    assert.equal(log.uploaded.length, 0);
  });

  await check("save timetable: 404 for a foreign teacher, 400 for a foreign class, else replaces and reports overlaps", async () => {
    const rows: TimetableWriteRow[] = [
      { class_id: CLASS_A, subject_id: 1, day_of_week: "monday", start_time: "08:00", end_time: "09:00", room: null, item_type: "class", title: null, notes: null },
      { class_id: null, subject_id: null, day_of_week: "monday", start_time: "08:30", end_time: "09:30", room: null, item_type: "duty", title: "Gate", notes: null },
    ];
    await rejectsWith(saveTimetable(makeStore(freshState()), OTHER_SCHOOL, TEACHER, rows), 404);
    await rejectsWith(saveTimetable(makeStore(freshState()), SCHOOL, TEACHER, [{ ...rows[0], class_id: FOREIGN_CLASS }]), 400);
    const state = freshState();
    const result = await saveTimetable(makeStore(state), SCHOOL, TEACHER, rows);
    assert.equal(state.replaced.length, 1);
    assert.equal(result.conflicts.length, 1);
  });

  await check("delete: 409 with the count when grades exist, force deletes and removes the photo, foreign school is 404", async () => {
    const { photos, log } = makePhotos();
    const graded = freshState({ gradingReports: 4 });
    await rejectsWith(deleteTeacher(makeStore(graded), photos, SCHOOL, TEACHER, false), 409, "TEACHER_HAS_GRADING_REPORTS");
    assert.equal(graded.deleted.length, 0);
    try {
      await deleteTeacher(makeStore(graded), photos, SCHOOL, TEACHER, false);
    } catch (err) {
      assert.deepEqual((err as ApiError).details, { grading_reports: 4 });
    }
    const result = await deleteTeacher(makeStore(graded), photos, SCHOOL, TEACHER, true);
    assert.equal(result.id, TEACHER);
    assert.deepEqual(graded.deleted, [TEACHER]);
    assert.deepEqual(log.removed, [`teachers/${TEACHER}/old.jpg`]);
    await rejectsWith(deleteTeacher(makeStore(freshState()), photos, OTHER_SCHOOL, TEACHER, true), 404);
    const clean = freshState();
    await deleteTeacher(makeStore(clean), photos, SCHOOL, TEACHER, false);
    assert.deepEqual(clean.deleted, [TEACHER]);
  });


  // ---- create -------------------------------------------------------------------
  const parseCreate = (over: Record<string, unknown> = {}): TeacherCreateParsed =>
    teacherCreateSchema.parse({ name: " New Teacher ", email: "new@school.test", phone: "0712345678", admission_number: "T-100", class_id: CLASS_A, subject_id: "2", ...over });

  await check("create: happy path returns the documented { id, teacher } shape and writes one plan", async () => {
    const { photos, log } = makePhotos();
    const state = freshState();
    const result = await createTeacher(makeStore(state), photos, SCHOOL, parseCreate(), fakeFile());
    assert.equal(state.created.length, 1);
    assert.equal(state.created[0].classId, CLASS_A);
    assert.equal(state.created[0].subjectId, 2);
    assert.equal(state.created[0].schoolId, SCHOOL);
    assert.equal(result.id, state.created[0].id);
    assert.deepEqual(Object.keys(result.teacher).sort(), ["admission_number", "class_labels", "class_teacher", "email", "id", "name", "phone", "profile_photo", "school_id", "school_name", "status", "subject_id", "subject_name"]);
    assert.equal(result.teacher.name, "New Teacher");
    assert.equal(result.teacher.school_name, "Green Academy");
    assert.equal(result.teacher.subject_name, "Subject 2");
    assert.deepEqual(result.teacher.class_labels, ["Grade 7 A"]);
    assert.equal(result.teacher.class_teacher, true);
    assert.equal(result.teacher.status, "active");
    assert.equal(log.uploaded.length, 1);
    assert.match(log.uploaded[0], new RegExp(`^teachers/${result.id}/`));
  });

  await check("create: class of another school 400, unknown subject 404, foreign school 404 - nothing uploaded or written", async () => {
    const { photos, log } = makePhotos();
    const state = freshState();
    await rejectsWith(createTeacher(makeStore(state), photos, SCHOOL, parseCreate({ class_id: FOREIGN_CLASS }), fakeFile()), 400);
    await rejectsWith(createTeacher(makeStore(state), photos, SCHOOL, parseCreate({ subject_id: "99" }), fakeFile()), 404);
    await rejectsWith(createTeacher(makeStore(state), photos, OTHER_SCHOOL, parseCreate({ class_id: FOREIGN_CLASS }), fakeFile()), 404);
    assert.equal(log.uploaded.length, 0);
    assert.equal(state.created.length, 0);
  });

  await check("create: teacher ID, email and class already taken are 409 with codes, before any upload", async () => {
    const { photos, log } = makePhotos();
    await rejectsWith(createTeacher(makeStore(freshState({ takenAdmission: true })), photos, SCHOOL, parseCreate(), fakeFile()), 409, "TEACHER_ID_TAKEN");
    await rejectsWith(createTeacher(makeStore(freshState({ takenEmail: true })), photos, SCHOOL, parseCreate(), fakeFile()), 409, "TEACHER_EMAIL_TAKEN");
    await rejectsWith(createTeacher(makeStore(freshState()), photos, SCHOOL, parseCreate({ class_id: CLASS_B }), fakeFile()), 409, "CLASS_TEACHER_TAKEN");
    assert.equal(log.uploaded.length, 0);
  });

  await check("create: when the transaction fails the uploaded photo is removed; a unique violation is a 409", async () => {
    const { photos, log } = makePhotos();
    await assert.rejects(createTeacher(makeStore(freshState({ failCreate: true })), photos, SCHOOL, parseCreate(), fakeFile()), /database exploded/);
    assert.equal(log.removed.length, 1);
    assert.match(String(log.removed[0]), /^teachers\//);

    const raced = makePhotos();
    const store = makeStore(freshState());
    store.createTeacher = async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    };
    await rejectsWith(createTeacher(store, raced.photos, SCHOOL, parseCreate(), fakeFile()), 409, "TEACHER_IDENTITY_TAKEN");
    assert.equal(raced.log.removed.length, 1);
  });

  await check("create request: keeps the old wording, ignores school_id, validates formats", async () => {
    const send = (fields: Record<string, string | File | undefined>) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.set(key, value);
      return new Request("http://localhost/api/teachers", { method: "POST", body: form });
    };
    const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], "a.png", { type: "image/png" });
    const base = { name: "Jo", email: "jo@school.test", phone: "0700", admission_number: "T-9", class_id: CLASS_A, subject_id: "3", photo: png, school_id: OTHER_SCHOOL };

    const ok = await readTeacherCreateRequest(send(base));
    assert.equal(ok.input.subject_id, 3);
    assert.equal("school_id" in ok.input, false);
    assert.equal(ok.photo.name, "a.png");

    const required = "Name, email, phone number, teacher ID, school, class, and subject are required.";
    for (const missing of ["name", "email", "phone", "admission_number", "class_id", "subject_id"]) {
      await assert.rejects(readTeacherCreateRequest(send({ ...base, [missing]: undefined })), (err: unknown) => err instanceof ApiError && err.status === 400 && err.message === required);
    }
    await assert.rejects(readTeacherCreateRequest(send({ ...base, subject_id: "abc" })), (err: unknown) => err instanceof ApiError && err.message === required);
    await assert.rejects(readTeacherCreateRequest(send({ ...base, photo: undefined })), (err: unknown) => err instanceof ApiError && err.message === "Teacher photo is required.");
    await assert.rejects(readTeacherCreateRequest(send({ ...base, email: "nope" })), (err: unknown) => err instanceof ApiError && err.status === 400);
    await assert.rejects(readTeacherCreateRequest(send({ ...base, class_id: "not-a-uuid" })), (err: unknown) => err instanceof ApiError && err.status === 400);
  });

  await check("photo path parser accepts only teachers/{uuid}/{file}", () => {
    assert.deepEqual(parsePhotoPath(`teachers/${TEACHER}/1700-abc.jpg`), { teacherId: TEACHER });
    assert.equal(parsePhotoPath(`teachers/${TEACHER}/../x.jpg`), null);
    assert.equal(parsePhotoPath(`teachers/${TEACHER}/sub/x.jpg`), null);
    assert.equal(parsePhotoPath(`logos/${TEACHER}/x.jpg`), null);
    assert.equal(parsePhotoPath("teachers/not-a-uuid/x.jpg"), null);
    assert.equal(parsePhotoPath(""), null);
    assert.equal(parsePhotoPath(null), null);
  });

  console.log(`${checks} checks, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
}

void main();
