// =============================================================================
// Portal shared helpers — the pieces the teacher, student, parent and admin
// portal repositories all need, written ONCE so the numbers agree everywhere.
// -----------------------------------------------------------------------------
// Rules this file protects:
//   * ONE attendance computation (getStudentAttendanceSummaries) for every portal.
//   * ONE way to average a percentage (integer hundredths -> no float drift), so a
//     child's average on the parent card equals the one on the child page.
//   * ONE "today" (Africa/Nairobi) so every portal agrees which day it is.
// Everything returned is JSON-safe (BigInt -> string, Date -> ISO string,
// Decimal -> number).
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import type {
  AttendanceSummary,
  GradeRow,
  LessonSlot,
  SubjectSummary,
  TodaySchedule,
} from "./portal-types";

// ── Limits (no query in the portals is allowed to be unbounded) ──────────────
/** A student has tens of reports; 500 is a safety cap, never a real limit. */
export const MAX_REPORTS_PER_STUDENT = 500;
/** A student takes ~10-15 subjects; 100 is a safety cap. */
export const MAX_SUBJECTS_PER_STUDENT = 100;
/** A teacher rarely has more than a few hundred assigned students; safety cap. */
export const MAX_ASSIGNED_STUDENTS = 2000;

// ── Small pure helpers ───────────────────────────────────────────────────────

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the text is shaped like a UUID.
 * Why it exists: Postgres uuid columns throw on malformed input, which would turn a
 * bad URL into a 500; routes check this first and answer 400/404 instead.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** "Grade 3" + "B" -> "Grade 3 B"; no class -> null. */
export function classLabel(
  c: { class_name: string; stream: string | null } | null | undefined,
): string | null {
  if (!c) return null;
  return c.stream ? `${c.class_name} ${c.stream}` : c.class_name;
}

/** Prisma Decimal / number / null -> number | null (never NaN). */
export function toNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Date -> ISO string, null stays null. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** "Amina" + "Wanjiru" -> "Amina Wanjiru". The legacy schema defaults names to the text "NULL". */
export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  const parts = [first, last]
    .map((p) => (p ?? "").trim())
    .filter((p) => p !== "" && p.toUpperCase() !== "NULL");
  return parts.join(" ");
}

/**
 * Mean of the non-null percentages, one decimal; null when there are none.
 * Uses integer hundredths so it matches meanFromSum() exactly (see getPctStatsByStudent).
 */
export function meanPct(values: Array<number | null | undefined>): number | null {
  let hundredthsSum = 0;
  let count = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    hundredthsSum += Math.round(v * 100);
    count += 1;
  }
  if (count === 0) return null;
  return Math.round(hundredthsSum / count / 10) / 10;
}

/** Same rounding as meanPct, starting from a database SUM + COUNT. */
function meanFromSum(sum: { toString(): string } | null, count: number): number | null {
  if (sum == null || count === 0) return null;
  const hundredthsSum = Math.round(Number(sum) * 100);
  return Math.round(hundredthsSum / count / 10) / 10;
}

/** One decimal place (rates on the admin overview). */
export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

// ── "Today" in Africa/Nairobi ────────────────────────────────────────────────

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Kenya has no daylight saving, so a fixed +03:00 offset is exact all year.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NairobiDay = {
  /** yyyy-mm-dd */
  date: string;
  /** "Monday" ... "Sunday" */
  weekday: string;
  /** First instant of the day (inclusive). */
  start: Date;
  /** First instant of the next day (exclusive). */
  end: Date;
  /** The date as a UTC-midnight Date, the shape Prisma uses for @db.Date columns. */
  dateOnly: Date;
};

/**
 * The calendar day that `now` falls in, in Africa/Nairobi.
 *
 * Why it exists: servers run in UTC; between 21:00 and 24:00 UTC it is already
 * "tomorrow" in Kenya, and timetables/attendance are keyed by the Kenyan day.
 *
 * @param now the instant to convert (defaults to the current time)
 */
export function getNairobiDay(now: Date = new Date()): NairobiDay {
  const shifted = new Date(now.getTime() + NAIROBI_OFFSET_MS);
  const utcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(utcMidnight - NAIROBI_OFFSET_MS);
  return {
    date: new Date(utcMidnight).toISOString().slice(0, 10),
    weekday: WEEKDAYS[shifted.getUTCDay()],
    start,
    end: new Date(start.getTime() + DAY_MS),
    dateOnly: new Date(utcMidnight),
  };
}

/** Postgres TIME columns arrive as 1970-01-01T<time>Z, so the wall-clock time lives in the UTC fields. */
export function formatTimeOfDay(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// ── Attendance (THE one computation) ─────────────────────────────────────────

/**
 * Turn present/late/absent counts into the AttendanceSummary shown in every portal.
 * `rate` = % present (late counts as present) of all recorded rows; 0 when nothing recorded.
 */
export function buildAttendanceSummary(counts: {
  present: number;
  late: number;
  absent: number;
}): AttendanceSummary {
  const total = counts.present + counts.late + counts.absent;
  const rate = total === 0 ? 0 : Math.round(((counts.present + counts.late) / total) * 100);
  return { present: counts.present, late: counts.late, absent: counts.absent, total, rate };
}

/**
 * Attendance summaries for many students in ONE query.
 *
 * Why it exists: the student, parent and teacher portals must show identical
 * numbers, and cards for many students must not run one query per student.
 *
 * @param students the students to summarise: `userId` is students.user_id (attendance
 *                 rows are keyed by it), `schoolId` scopes the read to their own school
 * @returns Map keyed by userId, with an entry for EVERY requested student (zeros when
 *          no rows). Callers that need "no data" semantics check `summary.total === 0`.
 */
export async function getStudentAttendanceSummaries(
  students: Array<{ userId: string; schoolId: string }>,
): Promise<Map<string, AttendanceSummary>> {
  const result = new Map<string, AttendanceSummary>();
  const userIds = Array.from(new Set(students.map((s) => s.userId)));
  const schoolIds = Array.from(new Set(students.map((s) => s.schoolId)));
  if (userIds.length === 0) return result;

  const groups = await prisma.attendance.groupBy({
    by: ["user_id", "status"],
    where: {
      user_type: "student",
      user_id: { in: userIds },
      school_id: { in: schoolIds },
    },
    _count: { _all: true },
  });

  const counts = new Map<string, { present: number; late: number; absent: number }>();
  for (const g of groups) {
    const entry = counts.get(g.user_id) ?? { present: 0, late: 0, absent: 0 };
    // Other statuses (e.g. "excused") were never counted before; keep it that way.
    if (g.status === "present") entry.present += g._count._all;
    else if (g.status === "late") entry.late += g._count._all;
    else if (g.status === "absent") entry.absent += g._count._all;
    counts.set(g.user_id, entry);
  }

  for (const userId of userIds) {
    result.set(userId, buildAttendanceSummary(counts.get(userId) ?? { present: 0, late: 0, absent: 0 }));
  }
  return result;
}

/** null when the student has no attendance rows at all (the cards show "-" instead of 0%). */
export function attendanceRateOrNull(summary: AttendanceSummary | undefined): number | null {
  if (!summary || summary.total === 0) return null;
  return summary.rate;
}

// ── Averages for many students in one query ─────────────────────────────────

export type PctStats = {
  /** Mean normalized_pct over the student's reports; null when none carry a percentage. */
  averagePct: number | null;
  /** How many reports the student has (any kind). 0 = "no reports at all". */
  reportCount: number;
};

/**
 * Average percentage and report count for many students in ONE grouped query.
 *
 * Why it exists: student lists (teacher portal, parent cards, attention list) need an
 * average per student; looping would be N+1.
 *
 * @param studentIds ids of students the caller has ALREADY verified it may see
 * @returns Map keyed by student id. Students with no reports are absent from the map.
 */
export async function getPctStatsByStudent(studentIds: string[]): Promise<Map<string, PctStats>> {
  const result = new Map<string, PctStats>();
  if (studentIds.length === 0) return result;

  const groups = await prisma.grading_reports.groupBy({
    by: ["student_id"],
    where: { student_id: { in: studentIds } },
    _count: { _all: true, normalized_pct: true },
    _sum: { normalized_pct: true },
  });

  for (const g of groups) {
    result.set(g.student_id, {
      averagePct: meanFromSum(g._sum.normalized_pct, g._count.normalized_pct),
      reportCount: g._count._all,
    });
  }
  return result;
}

// ── One student's grade reports ─────────────────────────────────────────────

export type ReportRow = {
  subjectId: string;
  subject: string;
  term: string;
  grade: string;
  rawScore: number | null;
  normalizedPct: number | null;
  createdAt: Date | null;
};

/**
 * Every grade report of ONE student, newest term first (this is what the portals list).
 *
 * @param studentId a student id the caller has ALREADY verified it may see
 *                  (grading_reports has no school_id, so ownership is checked upstream)
 */
export async function loadStudentReports(studentId: string): Promise<ReportRow[]> {
  const reports = await prisma.grading_reports.findMany({
    where: { student_id: studentId },
    orderBy: [{ term: "desc" }, { created_at: { sort: "desc", nulls: "last" } }],
    take: MAX_REPORTS_PER_STUDENT,
    select: {
      subject_id: true,
      term: true,
      grade: true,
      raw_score: true,
      normalized_pct: true,
      created_at: true,
      subjects: { select: { subject_name: true } },
    },
  });

  return reports.map((r) => ({
    subjectId: String(r.subject_id),
    subject: r.subjects?.subject_name ?? `Subject ${r.subject_id}`,
    term: r.term,
    grade: r.grade,
    rawScore: toNumber(r.raw_score),
    normalizedPct: toNumber(r.normalized_pct),
    createdAt: r.created_at,
  }));
}

/** ReportRow[] -> the GradeRow[] the API returns (adds createdAt as ISO text). */
export function toGradeRows(rows: ReportRow[]): GradeRow[] {
  return rows.map((r) => ({
    subject: r.subject,
    term: r.term,
    grade: r.grade,
    rawScore: r.rawScore,
    normalizedPct: r.normalizedPct,
    createdAt: toIso(r.createdAt),
  }));
}

/** Is report `a` more recent than `b`? Newer created_at wins; on a tie the later term name wins. */
export function isNewerReport(
  a: { createdAt: Date | null; term: string },
  b: { createdAt: Date | null; term: string },
): boolean {
  const at = a.createdAt ? a.createdAt.getTime() : -Infinity;
  const bt = b.createdAt ? b.createdAt.getTime() : -Infinity;
  if (at !== bt) return at > bt;
  return a.term > b.term;
}

// ── Subjects a student takes ────────────────────────────────────────────────

export type ActiveSubject = { id: string; name: string; teacherName: string | null };

/**
 * The student's active subjects with the teacher's name (2 queries, no per-row lookups).
 *
 * @param studentId a student the caller has ALREADY verified it may see
 * @param schoolId  that student's school (teacher names are read inside it only)
 */
export async function loadActiveSubjects(studentId: string, schoolId: string): Promise<ActiveSubject[]> {
  const rows = await prisma.student_subjects.findMany({
    where: { student_id: studentId, is_active: true },
    orderBy: { subjects: { subject_name: "asc" } },
    take: MAX_SUBJECTS_PER_STUDENT,
    select: {
      subject_id: true,
      teacher_id: true,
      subjects: { select: { subject_name: true } },
    },
  });

  const teacherIds = Array.from(
    new Set(rows.map((r) => r.teacher_id).filter((id): id is string => id !== null)),
  );
  const teacherNames = await getTeacherNames(teacherIds, schoolId);

  return rows.map((r) => ({
    id: String(r.subject_id),
    name: r.subjects.subject_name,
    teacherName: r.teacher_id ? teacherNames.get(r.teacher_id) ?? null : null,
  }));
}

/**
 * Combine a student's active subjects with their reports into SubjectSummary[].
 * `averagePct` = mean normalizedPct for the subject; `latestGrade` = grade of the newest report.
 */
export function summarizeSubjects(subjects: ActiveSubject[], reports: ReportRow[]): SubjectSummary[] {
  const bySubject = new Map<string, ReportRow[]>();
  for (const r of reports) {
    const list = bySubject.get(r.subjectId) ?? [];
    list.push(r);
    bySubject.set(r.subjectId, list);
  }

  return subjects.map((s) => {
    const list = bySubject.get(s.id) ?? [];
    let latest: ReportRow | null = null;
    for (const r of list) {
      if (latest === null || isNewerReport(r, latest)) latest = r;
    }
    return {
      id: s.id,
      name: s.name,
      teacherName: s.teacherName,
      averagePct: meanPct(list.map((r) => r.normalizedPct)),
      latestGrade: latest ? latest.grade : null,
    };
  });
}

/** teacher id -> teacher name, for teachers of ONE school (one query). */
export async function getTeacherNames(teacherIds: string[], schoolId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (teacherIds.length === 0) return names;
  const teachers = await prisma.teachers.findMany({
    where: { id: { in: teacherIds }, school_id: schoolId },
    select: { id: true, name: true },
  });
  for (const t of teachers) names.set(t.id, t.name);
  return names;
}

// ── Timetable ("today") ─────────────────────────────────────────────────────

/** The timetable columns every portal reads (teacher name and subject name are joined in). */
export const TIMETABLE_SELECT = {
  id: true,
  class_id: true,
  start_time: true,
  end_time: true,
  room: true,
  item_type: true,
  title: true,
  subjects: { select: { subject_name: true } },
  teachers: { select: { name: true } },
} as const;

export type TimetableRow = {
  id: string;
  class_id: string | null;
  start_time: Date;
  end_time: Date;
  room: string | null;
  item_type: string | null;
  title: string | null;
  subjects: { subject_name: string } | null;
  teachers: { name: string };
};

/** One timetable row -> the LessonSlot the UI renders ("HH:mm" times). */
export function toLessonSlot(row: TimetableRow, className: string | null): LessonSlot {
  return {
    id: row.id,
    startTime: formatTimeOfDay(row.start_time),
    endTime: formatTimeOfDay(row.end_time),
    itemType: row.item_type,
    title: row.title,
    room: row.room,
    className,
    subjectName: row.subjects?.subject_name ?? null,
    teacherName: row.teachers.name,
  };
}

/** Lessons + the day they belong to -> TodaySchedule (sorted by start time; empty is fine). */
export function buildTodaySchedule(day: NairobiDay, lessons: LessonSlot[]): TodaySchedule {
  const sorted = [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { date: day.date, weekday: day.weekday, lessons: sorted };
}

/**
 * Today's timetable for ONE class (the student / parent view).
 *
 * @param schoolId  the class's school (timetable rows are filtered by it)
 * @param classId   the class; null (student not placed in a class) -> no lessons
 * @param className label to show on each lesson
 */
export async function loadClassSchedule(
  schoolId: string,
  classId: string | null,
  className: string | null,
  day: NairobiDay,
): Promise<TodaySchedule> {
  if (!classId) return buildTodaySchedule(day, []);

  const rows = await prisma.teacher_timetables.findMany({
    where: {
      school_id: schoolId,
      class_id: classId,
      day_of_week: { equals: day.weekday, mode: "insensitive" },
    },
    orderBy: { start_time: "asc" },
    take: 50, // one class never has more than a few dozen slots in a day
    select: TIMETABLE_SELECT,
  });
  return buildTodaySchedule(
    day,
    rows.map((r) => toLessonSlot(r, className)),
  );
}
