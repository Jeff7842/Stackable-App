// =============================================================================
// Self-check for the student admin logic. Run:  pnpm exec tsx lib/validation/students.check.ts
// -----------------------------------------------------------------------------
// No framework, no database, no network. Covers: the zod update schema, the row ->
// DTO mappers (Date/BigInt-typed and plain string-typed rows must give IDENTICAL JSON), and the
// rules in student-admin.service.ts through an in-memory fake store. Exits non-zero on failure.
// =============================================================================

import assert from "node:assert/strict";
import { ApiError } from "@/lib/api/errors";
import { __setRedisForTests } from "@/lib/cache";
import {
  buildStatusCounts,
  summariseAttendance,
  toStudentClassOptions,
  toStudentListItem,
  toStudentProfile,
  type StudentListRaw,
  type StudentProfileRaw,
} from "@/lib/mappers/student-admin.mapper";
import { deleteStudent, updateStudent } from "@/lib/services/student-admin.service";
import type { StudentAdminStore, StudentFieldChanges } from "@/lib/services/student-admin.store";
import { isCalendarDate, studentUpdateSchema, type StudentUpdateParsed } from "@/lib/validation/students";
import type { StudentListItem } from "@/lib/dto/students";

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

async function rejectsWith(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${String(err)}`);
    assert.equal(err.status, status, `status ${err.status}: ${err.message}`);
    return;
  }
  assert.fail(`expected a ${status} rejection`);
}

__setRedisForTests(null); // no Redis: bumpCache() is a no-op

const SCHOOL = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "99999999-9999-9999-9999-999999999999";
const STUDENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLASS_OK = "c1111111-1111-1111-1111-111111111111";
const CLASS_FOREIGN = "c2222222-2222-2222-2222-222222222222";

function makeStore(log: { updates: StudentFieldChanges[]; removed: string[] }): StudentAdminStore {
  const item = { id: STUDENT } as StudentListItem;
  return {
    list: async () => { throw new Error("not used"); },
    getProfile: async () => null,
    getListItem: async (schoolId, id) => (schoolId === SCHOOL && id === STUDENT ? item : null),
    formOptions: async () => { throw new Error("not used"); },
    classExists: async (schoolId, classId) => schoolId === SCHOOL && classId === CLASS_OK,
    update: async (schoolId, id, changes) => {
      if (schoolId !== SCHOOL || id !== STUDENT) return false;
      log.updates.push(changes);
      return true;
    },
    remove: async (schoolId, id) => {
      if (schoolId !== SCHOOL || id !== STUDENT) return false;
      log.removed.push(id);
      return true;
    },
  };
}

const parseUpdate = (input: unknown): StudentUpdateParsed => studentUpdateSchema.parse(input);

async function main(): Promise<void> {
  // ---- schema -------------------------------------------------------------------
  await check("isCalendarDate rejects impossible dates", () => {
    assert.equal(isCalendarDate("2010-02-28"), true);
    assert.equal(isCalendarDate("2010-02-30"), false);
    assert.equal(isCalendarDate("2010-2-3"), false);
    assert.equal(isCalendarDate("nope"), false);
  });

  await check("update schema: empty body rejected, unknown keys stripped, names/school not editable", () => {
    assert.equal(studentUpdateSchema.safeParse({}).success, false);
    const parsed = studentUpdateSchema.parse({ status: "suspended", first_name: "Hack", school_id: OTHER_SCHOOL, admission_no: "X" });
    assert.deepEqual(parsed, { status: "suspended" });
  });

  await check("update schema: status enum, class id shape, clearing text and dates", () => {
    assert.equal(studentUpdateSchema.safeParse({ status: "deleted" }).success, false);
    assert.equal(studentUpdateSchema.safeParse({ class_id: "abc" }).success, false);
    assert.equal(studentUpdateSchema.parse({ class_id: null }).class_id, null);
    assert.deepEqual(studentUpdateSchema.parse({ phone: " 0700 ", phone2: "", location: "  " }), { phone: "0700", phone2: null, location: null });
    assert.equal(studentUpdateSchema.parse({ date_of_birth: "" }).date_of_birth, null);
    assert.equal(studentUpdateSchema.parse({ date_of_birth: "2012-04-05" }).date_of_birth, "2012-04-05");
    assert.equal(studentUpdateSchema.safeParse({ date_of_birth: "2999-01-01" }).success, false);
    assert.equal(studentUpdateSchema.safeParse({ date_of_birth: "2012-13-40" }).success, false);
  });

  // ---- mappers ------------------------------------------------------------------
  const prismaRow: StudentListRaw = {
    id: STUDENT, user_id: "u1", school_id: SCHOOL, school_name: "Green", admission_no: "A1", first_name: "Amina", last_name: "Otieno",
    class_id: CLASS_OK, date_of_birth: new Date("2012-04-05T00:00:00.000Z"), phone: "0700", phone2: null, email: null,
    profile_picture: null, status: "active", average_grade: "B+", created_at: new Date("2026-01-05T10:00:00.000Z"),
  };
  const stringRow: StudentListRaw = { ...prismaRow, date_of_birth: "2012-04-05", created_at: "2026-01-05T10:00:00+00:00" };

  await check("list item: identical JSON from Date/BigInt-typed and plain string-typed rows", () => {
    const klass = { class_name: "Grade 7", stream: "A" };
    assert.deepEqual(toStudentListItem(prismaRow, klass, 2), toStudentListItem(stringRow, klass, 2));
    const item = toStudentListItem(prismaRow, klass, 2);
    assert.equal(item.class_label, "Grade 7 A");
    assert.equal(item.date_of_birth, "2012-04-05");
    assert.equal(item.created_at, "2026-01-05T10:00:00.000Z");
    assert.equal(item.full_name, "Amina Otieno");
    assert.equal(toStudentListItem(prismaRow, null, 0).class_label, null);
    assert.equal(toStudentListItem({ ...prismaRow, first_name: " ", last_name: "" }, null, 0).full_name, "Unnamed student");
  });

  await check("status counts: unknown statuses only count toward all", () => {
    const counts = buildStatusCounts([{ status: "active", count: 5 }, { status: "graduated", count: 2 }, { status: "weird", count: 1 }]);
    assert.deepEqual(counts, { all: 8, active: 5, suspended: 0, pending: 0, removed: 0, graduated: 2 });
  });

  await check("attendance summary: late counts as attended, empty is 0%", () => {
    assert.deepEqual(summariseAttendance([{ status: "present", count: 6 }, { status: "late", count: 2 }, { status: "absent", count: 2 }]), { present: 6, late: 2, absent: 2, total: 10, rate: 80 });
    assert.deepEqual(summariseAttendance([]), { present: 0, late: 0, absent: 0, total: 0, rate: 0 });
  });

  await check("class options sort numerically (Grade 2 before Grade 10)", () => {
    const options = toStudentClassOptions([
      { id: "a", class_name: "Grade 10", stream: null },
      { id: "b", class_name: "Grade 2", stream: "B" },
      { id: "c", class_name: "Grade 2", stream: "A" },
    ]);
    assert.deepEqual(options.map((o) => o.label), ["Grade 2 A", "Grade 2 B", "Grade 10"]);
  });

  await check("profile: email falls back to the account, guardians primary-first, average letter, phones as text", () => {
    const raw = (student: StudentListRaw): StudentProfileRaw => ({
      student: { ...student, class_teacher_id: null, location: null, home_address: "Nairobi", emergency_contact: null, health_status: null, other_info: null, activity: null },
      classItem: { class_name: "Grade 7", stream: null },
      classTeacher: { id: "t1", name: "Jane" },
      account: { first_name: "Amina", last_name: "Otieno", email: "amina@login.test", phone: BigInt("254700111222") },
      guardians: [
        { parent_id: "p2", first_name: "Zed", last_name: "Parent", email: null, phone: 111, alternate_phone: null, relationship: "uncle", is_primary: false, primary_role: null, status: "active" },
        { parent_id: "p1", first_name: "Ann", last_name: "Parent", email: "a@p.test", phone: BigInt("254700000001"), alternate_phone: "0711", relationship: "mother", is_primary: true, primary_role: "fees", status: "active" },
      ],
      subjects: [
        { subject_id: BigInt("2"), subject_name: "Math", teacher_id: "t1", teacher_name: "Jane" },
        { subject_id: 1, subject_name: "Art", teacher_id: null, teacher_name: null },
      ],
      recentGrades: [{ subject_id: BigInt("2"), subject_name: "Math", term: "T1", grade: "B", raw_score: "71.50", normalized_pct: null, created_at: new Date("2026-02-01T08:00:00Z") }],
      avgScore: 10.4,
      attendance: [{ status: "present", count: 3 }],
    });
    const a = toStudentProfile(raw(prismaRow));
    const b = toStudentProfile(raw(stringRow));
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
    assert.equal(a.student.email, "amina@login.test");
    assert.deepEqual(a.guardians.map((g) => g.parent_id), ["p1", "p2"]);
    assert.equal(a.guardians[0].phone, "254700000001");
    assert.deepEqual(a.subjects.map((s) => s.subject_name), ["Art", "Math"]);
    assert.deepEqual(a.average, { avg_score: 10.4, grade: "B" });
    assert.equal(a.recent_grades[0].raw_score, 71.5);
    assert.equal(a.student.account?.phone, "254700111222");
    const none = toStudentProfile({ ...raw(prismaRow), avgScore: null });
    assert.deepEqual(none.average, { avg_score: null, grade: null });
  });

  // ---- service rules ------------------------------------------------------------
  await check("update: class of another school is 400, unknown student / foreign school is 404, nothing written on failure", async () => {
    const log = { updates: [] as StudentFieldChanges[], removed: [] as string[] };
    await rejectsWith(updateStudent(makeStore(log), SCHOOL, STUDENT, parseUpdate({ class_id: CLASS_FOREIGN })), 400);
    await rejectsWith(updateStudent(makeStore(log), OTHER_SCHOOL, STUDENT, parseUpdate({ status: "suspended" })), 404);
    await rejectsWith(updateStudent(makeStore(log), SCHOOL, "dddddddd-dddd-dddd-dddd-dddddddddddd", parseUpdate({ status: "suspended" })), 404);
    assert.equal(log.updates.length, 0);
  });

  await check("update: only the fields sent are written; class can be cleared", async () => {
    const log = { updates: [] as StudentFieldChanges[], removed: [] as string[] };
    const result = await updateStudent(makeStore(log), SCHOOL, STUDENT, parseUpdate({ status: "suspended", class_id: null }));
    assert.deepEqual(log.updates[0], { status: "suspended", class_id: null });
    assert.equal(result.student.id, STUDENT);
    await updateStudent(makeStore(log), SCHOOL, STUDENT, parseUpdate({ class_id: CLASS_OK, phone: "" }));
    assert.deepEqual(log.updates[1], { class_id: CLASS_OK, phone: null });
  });

  await check("delete: scoped to the school; foreign school and unknown id are 404", async () => {
    const log = { updates: [] as StudentFieldChanges[], removed: [] as string[] };
    await rejectsWith(deleteStudent(makeStore(log), OTHER_SCHOOL, STUDENT), 404);
    assert.equal(log.removed.length, 0);
    assert.deepEqual(await deleteStudent(makeStore(log), SCHOOL, STUDENT), { id: STUDENT });
    assert.deepEqual(log.removed, [STUDENT]);
  });

  console.log(`${checks} checks, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
}

void main();
