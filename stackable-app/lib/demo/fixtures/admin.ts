// School admin handlers: overview and the students directory (list, profile, update, delete).
import { STUDENT_STATUSES, type StudentFormOptions, type StudentListData, type StudentListItem, type StudentProfile, type StudentStatus, type StudentUpdateInput } from "@/lib/dto/students";
import type { AdminOverviewData } from "@/lib/repositories/portal-types";
import { route, type DemoRequest } from "../router";
import {
  CLASSES,
  SCHOOL,
  SUBJECTS,
  TERM,
  classIndexOf,
  classTeacherName,
  seedTeachers,
  studentAttendance,
  studentAvgGrade,
  studentAvgPct,
  studentGrades,
  studentIndex,
  table,
} from "./data";

type Extra = Partial<Record<"location" | "home_address" | "emergency_contact" | "health_status" | "other_info", string | null>>;
const bad = (error: string, code = "BAD_REQUEST", status = 400) => ({ status, body: { error, code } });
const classOptions = () => CLASSES.map(({ id, class_name, stream, label }) => ({ id, class_name, stream, label }));
const schoolOptions = () => [{ id: SCHOOL.id, name: SCHOOL.name }];

function students(db: DemoRequest["db"]) {
  return table<StudentListItem>(db, "students");
}

function overview(db: DemoRequest["db"]): AdminOverviewData {
  const list = students(db).filter((s) => s.status !== "removed");
  const total = list.length;
  const trend = Array.from({ length: 7 }, (_, d) => {
    const date = new Date(Date.now() - (6 - d) * 86_400_000).toISOString().slice(0, 10);
    const present = Math.round(total * (0.88 + ((d * 3) % 7) / 100));
    return { date, present, total, rate: Math.round((present / total) * 1000) / 10 };
  });
  const today = trend[6];
  const late = Math.round(total * 0.04);
  return {
    generatedAt: new Date().toISOString(),
    school: { id: SCHOOL.id, name: SCHOOL.name },
    totals: { students: total, teachers: table(db, "teachers").length, classes: CLASSES.length, subjects: SUBJECTS.length, parents: Math.round(total * 0.75) },
    attendanceToday: { present: today.present, late, absent: total - today.present - late, total, rate: today.rate, source: "attendance" },
    attendanceTrend: trend,
    classPerformance: CLASSES.map((c) => {
      const members = list.filter((s) => s.class_id === c.id);
      const avg = members.length ? members.reduce((sum, s) => sum + studentAvgPct(studentIndex(s.id)), 0) / members.length : null;
      return {
        classId: c.id,
        className: c.label,
        studentCount: members.length,
        presentToday: Math.round(members.length * 0.92),
        averageScore: avg === null ? null : Math.round(avg * 10) / 10,
        averageGrade: avg === null ? null : studentAvgGrade(studentIndex(members[0].id)),
      };
    }),
    recentGrades: list.slice(0, 6).map((s, n) => {
      const g = studentGrades(studentIndex(s.id))[n % SUBJECTS.length];
      return { id: `rg-${s.id}`, studentName: s.full_name, className: s.class_label, subject: g.subject, term: TERM, grade: g.grade, normalizedPct: g.normalizedPct, createdAt: g.createdAt };
    }),
    recentActivity: list.slice(0, 5).map((s, n) => ({
      id: `act-${s.id}`,
      kind: n % 2 ? ("grade" as const) : ("student" as const),
      title: n % 2 ? `Grade recorded for ${s.full_name}` : `${s.full_name} joined ${s.class_label}`,
      detail: n % 2 ? SUBJECTS[n].name : null,
      at: new Date(Date.now() - n * 3_600_000).toISOString(),
    })),
  };
}

function guardiansOf(i: number, last: string): StudentProfile["guardians"] {
  const first = ["Amina", "Rose", "Joseph", "Fatma", "Peter", "Beatrice"][i % 6];
  const g = (n: number, name: string, rel: string, primary: boolean) => ({
    parent_id: `par-${i + 1}-${n}`,
    name,
    email: `${name.split(" ")[0].toLowerCase()}.${last.toLowerCase()}@demo.stackable.school`,
    phone: `+2547330${String(100 + i).padStart(5, "0")}`,
    alternate_phone: null,
    relationship: rel,
    is_primary: primary,
    primary_role: primary ? "fees" : null,
    status: "active",
  });
  return i % 2 ? [g(1, `${first} ${last}`, "mother", true), g(2, `Michael ${last}`, "father", false)] : [g(1, `${first} ${last}`, "guardian", true)];
}

function profile(db: DemoRequest["db"], row: StudentListItem): StudentProfile {
  const i = studentIndex(row.id);
  const extra = ((db.studentExtra ?? {}) as Record<string, Extra>)[row.id] ?? {};
  const classIdx = classIndexOf(row.class_id);
  const teachers = seedTeachers();
  const pct = i >= 0 ? studentAvgPct(i) : null;
  return {
    student: {
      id: row.id,
      user_id: row.user_id,
      school_id: row.school_id,
      school_name: row.school_name,
      admission_no: row.admission_no,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: row.full_name,
      class_id: row.class_id,
      class_label: row.class_label,
      class_teacher_id: null,
      class_teacher_name: classIdx >= 0 ? classTeacherName(classIdx) : null,
      date_of_birth: row.date_of_birth,
      phone: row.phone,
      phone2: row.phone2,
      email: row.email,
      location: extra.location ?? "Nairobi",
      home_address: extra.home_address ?? null,
      emergency_contact: extra.emergency_contact ?? row.phone,
      health_status: extra.health_status ?? null,
      other_info: extra.other_info ?? null,
      activity: null,
      profile_picture: row.profile_picture,
      status: row.status,
      created_at: row.created_at,
      account: { first_name: row.first_name ?? "", last_name: row.last_name, email: row.email, phone: row.phone },
    },
    average: { avg_score: pct === null ? null : Math.round((pct / 100) * 120) / 10, grade: i >= 0 ? studentAvgGrade(i) : row.average_grade },
    guardians: guardiansOf(Math.max(i, 0), row.last_name),
    subjects: SUBJECTS.map((s) => {
      const t = teachers.find((x) => x.subject_id === s.id);
      return { subject_id: s.id, subject_name: s.name, teacher_id: t?.id ?? null, teacher_name: t?.name ?? null };
    }),
    recent_grades: (i >= 0 ? studentGrades(i) : []).map((g, n) => ({
      subject_id: SUBJECTS[n].id,
      subject_name: g.subject,
      term: g.term,
      grade: g.grade,
      raw_score: g.rawScore,
      normalized_pct: g.normalizedPct,
      created_at: g.createdAt,
    })),
    attendance: i >= 0 ? studentAttendance(i) : { present: 0, late: 0, absent: 0, total: 0, rate: 0 },
  };
}

function applyUpdate(db: DemoRequest["db"], row: StudentListItem, input: StudentUpdateInput) {
  const blank = (v: string | null | undefined) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim());
  if (input.status !== undefined) row.status = input.status;
  if (input.class_id !== undefined) {
    const cls = CLASSES.find((c) => c.id === input.class_id);
    row.class_id = cls?.id ?? null;
    row.class_label = cls?.label ?? null;
  }
  if (input.phone !== undefined) row.phone = blank(input.phone) ?? null;
  if (input.phone2 !== undefined) row.phone2 = blank(input.phone2) ?? null;
  if (input.date_of_birth !== undefined) row.date_of_birth = blank(input.date_of_birth) ?? null;
  const extras = (db.studentExtra ??= {}) as Record<string, Extra>;
  const extra = (extras[row.id] ??= {});
  for (const key of ["location", "home_address", "emergency_contact", "health_status", "other_info"] as const) {
    if (input[key] !== undefined) extra[key] = blank(input[key]) ?? null;
  }
}

export function registerAdmin(): void {
  route("GET", "/api/admin/overview", ({ db }) => ({ ok: true, data: overview(db) }));

  route("GET", "/api/students", ({ db }) => {
    const list = students(db);
    const counts = { all: list.length, ...Object.fromEntries(STUDENT_STATUSES.map((s) => [s, list.filter((r) => r.status === s).length])) } as StudentListData["counts"];
    const data: StudentListData = { students: list, total: list.length, truncated: false, counts, classes: classOptions(), schools: schoolOptions() };
    return { ok: true, data };
  });
  route("GET", "/api/students/form-options", () => {
    const data: StudentFormOptions = { classes: classOptions(), schools: schoolOptions(), statuses: STUDENT_STATUSES };
    return { ok: true, data };
  });
  route("GET", "/api/students/:id", ({ db, params }) => {
    const row = students(db).find((s) => s.id === params.id);
    return row ? { ok: true, data: profile(db, row) } : bad("Student not found.", "NOT_FOUND", 404);
  });
  route("PATCH", "/api/students/:id", ({ db, params, body }) => {
    const row = students(db).find((s) => s.id === params.id);
    if (!row) return bad("Student not found.", "NOT_FOUND", 404);
    const input = (body ?? {}) as StudentUpdateInput;
    if (input.status !== undefined && !(STUDENT_STATUSES as readonly string[]).includes(input.status as StudentStatus)) {
      return bad("That status is not valid.");
    }
    if (input.class_id && !CLASSES.some((c) => c.id === input.class_id)) return bad("That class does not exist.");
    if (input.date_of_birth && new Date(input.date_of_birth).getTime() > Date.now()) return bad("Date of birth cannot be in the future.");
    applyUpdate(db, row, input);
    return { ok: true, data: { student: row } };
  });
  route("DELETE", "/api/students/:id", ({ db, params }) => {
    const list = students(db);
    const at = list.findIndex((s) => s.id === params.id);
    if (at < 0) return bad("Student not found.", "NOT_FOUND", 404);
    list.splice(at, 1);
    return { ok: true, data: { id: params.id } };
  });
}
