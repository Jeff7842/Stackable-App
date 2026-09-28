// =============================================================================
// Defensive normalisers for the student + parent portal payloads.
// -----------------------------------------------------------------------------
// The backend lane (PORTALS-BACKEND) is implementing the contract in
// lib/repositories/portal-types.ts in parallel. Until it lands the endpoints may
// still return only the OLD subset of fields (no `subjects`, `today`,
// `averagePct`, `attendanceRate`, `latestGrade`, `createdAt` ...).
//
// Every hook runs its response through one of these functions, so pages always
// receive the FULL contract type with safe defaults and never need scattered
// `?.` / `?? []` guards. Pure (no React, no server imports): safe anywhere.
// =============================================================================

import type {
  AttendanceSummary,
  ChildCard,
  ChildOverview,
  GradeRow,
  LessonSlot,
  StudentDashboardData,
  SubjectSummary,
  TodaySchedule,
} from "@/lib/repositories/portal-types";

type Rec = Record<string, unknown>;

/** Treat anything that is not a plain object as an empty object. */
function rec(value: unknown): Rec {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Rec) : {};
}

/** Finite number from a number or numeric string, else null. */
function toNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Non-empty string, else null. */
function toStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function toInt(value: unknown, fallback = 0): number {
  const n = toNum(value);
  return n === null ? fallback : Math.round(n);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ── Shared building blocks ────────────────────────────────────────────────────
export function normalizeGrades(rows: unknown): GradeRow[] {
  return list(rows).map((item) => {
    const r = rec(item);
    return {
      subject: toStr(r.subject) ?? "Subject",
      term: toStr(r.term) ?? "Term",
      grade: typeof r.grade === "string" ? r.grade : "",
      rawScore: toNum(r.rawScore),
      normalizedPct: toNum(r.normalizedPct),
      createdAt: toStr(r.createdAt),
    };
  });
}

export function normalizeAttendance(raw: unknown): AttendanceSummary {
  const r = rec(raw);
  const present = toInt(r.present);
  const late = toInt(r.late);
  const absent = toInt(r.absent);
  const total = toInt(r.total, present + late + absent);
  // `rate` is the % present (+late) of total; derive it when the server omitted it.
  const rate = toNum(r.rate) ?? (total > 0 ? Math.round(((present + late) / total) * 100) : 0);
  return { present, late, absent, total, rate };
}

export function normalizeSubjects(rows: unknown): SubjectSummary[] {
  return list(rows).map((item, index) => {
    const r = rec(item);
    const name = toStr(r.name) ?? "Subject";
    return {
      id: toStr(r.id) ?? `${name}-${index}`,
      name,
      teacherName: toStr(r.teacherName),
      averagePct: toNum(r.averagePct),
      latestGrade: toStr(r.latestGrade),
    };
  });
}

function normalizeLesson(item: unknown, index: number): LessonSlot {
  const r = rec(item);
  const startTime = toStr(r.startTime) ?? "";
  return {
    id: toStr(r.id) ?? `${startTime}-${index}`,
    startTime,
    endTime: toStr(r.endTime) ?? "",
    itemType: toStr(r.itemType),
    title: toStr(r.title),
    room: toStr(r.room),
    className: toStr(r.className),
    subjectName: toStr(r.subjectName),
    teacherName: toStr(r.teacherName),
  };
}

export function normalizeToday(raw: unknown): TodaySchedule {
  const r = rec(raw);
  return {
    date: toStr(r.date) ?? "",
    weekday: toStr(r.weekday) ?? "",
    lessons: list(r.lessons).map(normalizeLesson),
  };
}

// ── Student ───────────────────────────────────────────────────────────────────
export function normalizeStudentDashboard(raw: unknown): StudentDashboardData {
  const r = rec(raw);
  const s = rec(r.student);
  if (Object.keys(s).length === 0) {
    throw new Error("Your dashboard came back empty. Please try again in a moment.");
  }
  const subjects = normalizeSubjects(r.subjects);
  return {
    student: {
      id: toStr(s.id) ?? "",
      firstName: toStr(s.firstName),
      lastName: toStr(s.lastName) ?? "",
      admissionNo: toStr(s.admissionNo) ?? "",
      className: toStr(s.className),
      averageGrade: toStr(s.averageGrade),
      status: toStr(s.status) ?? "active",
      profilePicture: toStr(s.profilePicture),
      classTeacherName: toStr(s.classTeacherName),
    },
    subjectCount: toInt(r.subjectCount, subjects.length),
    grades: normalizeGrades(r.grades),
    attendance: normalizeAttendance(r.attendance),
    subjects,
    today: normalizeToday(r.today),
  };
}

// ── Parent ────────────────────────────────────────────────────────────────────
export function normalizeChildCards(rows: unknown): ChildCard[] {
  const out: ChildCard[] = [];
  for (const item of list(rows)) {
    const r = rec(item);
    const studentId = toStr(r.studentId);
    if (!studentId) continue; // a card without an id cannot link anywhere
    const lg = rec(r.latestGrade);
    const latestGrade =
      toStr(lg.grade) !== null
        ? {
            subject: toStr(lg.subject) ?? "Subject",
            term: toStr(lg.term) ?? "",
            grade: toStr(lg.grade) ?? "",
            normalizedPct: toNum(lg.normalizedPct),
          }
        : null;
    out.push({
      studentId,
      firstName: toStr(r.firstName),
      lastName: toStr(r.lastName) ?? "",
      admissionNo: toStr(r.admissionNo) ?? "",
      className: toStr(r.className),
      profilePicture: toStr(r.profilePicture),
      averageGrade: toStr(r.averageGrade),
      relationship: toStr(r.relationship) ?? "guardian",
      isPrimary: r.isPrimary === true,
      subjectCount: toInt(r.subjectCount),
      averagePct: toNum(r.averagePct),
      attendanceRate: toNum(r.attendanceRate),
      latestGrade,
    });
  }
  return out;
}

export function normalizeChildOverview(raw: unknown): ChildOverview {
  const r = rec(raw);
  const s = rec(r.student);
  if (Object.keys(s).length === 0) {
    throw new Error("This profile came back empty. Please try again in a moment.");
  }
  return {
    student: {
      id: toStr(s.id) ?? "",
      firstName: toStr(s.firstName),
      lastName: toStr(s.lastName) ?? "",
      admissionNo: toStr(s.admissionNo) ?? "",
      className: toStr(s.className),
      profilePicture: toStr(s.profilePicture),
      status: toStr(s.status) ?? "active",
      averageGrade: toStr(s.averageGrade),
      averagePct: toNum(s.averagePct),
      dateOfBirth: toStr(s.dateOfBirth),
      classTeacherName: toStr(s.classTeacherName),
    },
    grades: normalizeGrades(r.grades),
    attendance: normalizeAttendance(r.attendance),
    subjects: normalizeSubjects(r.subjects),
  };
}
