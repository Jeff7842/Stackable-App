// =============================================================================
// Admin overview repository — the numbers on the school principal's home page.
// -----------------------------------------------------------------------------
// One function, getAdminOverview(schoolId): totals, today's attendance, a 7-day
// attendance trend, per-class performance, the latest grades and a merged
// activity feed. EVERY query is filtered by the school id the caller passes (the
// route takes it from the session, never from the request).
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import type {
  AdminActivityItem,
  AdminAttendanceDay,
  AdminClassPerformance,
  AdminOverviewData,
  AdminRecentGrade,
} from "./portal-types";
import { classLabel, fullName, getNairobiDay, round1, toIso, toNumber } from "./portal-shared";

export type { AdminOverviewData } from "./portal-types";

const TREND_DAYS = 7; // the trend chart shows the last 7 recorded days
const RECENT_GRADES_LIMIT = 8; // latest grades table
const ACTIVITY_LIMIT = 8; // merged activity feed
const MAX_CLASSES = 100; // a school has dozens of classes; safety cap
const MAX_TODAY_ATTENDANCE_ROWS = 20000; // one row per student per day is expected; safety cap
const MAX_PERFORMANCE_ROWS = 3000; // classes x subjects; safety cap

type StatusCounts = { present: number; late: number; absent: number };

/** present + late count as attending; returns a 0-100 rate with one decimal, or null when total is 0. */
function attendanceRate(attending: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(100, round1((attending / total) * 100));
}

/** Most frequent value in the list (ties: the first seen); null for an empty list. */
function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (best === null || n > (counts.get(best) ?? 0)) best = v;
  }
  return best;
}

/**
 * Today's student attendance from the `attendance` table (Africa/Nairobi day).
 * A student can clock in more than once; the FIRST record of the day decides their status.
 */
async function readAttendanceFromLog(schoolId: string, start: Date, end: Date): Promise<StatusCounts & { total: number }> {
  const rows = await prisma.attendance.findMany({
    where: { school_id: schoolId, user_type: "student", clock_in: { gte: start, lt: end } },
    orderBy: { clock_in: "asc" },
    take: MAX_TODAY_ATTENDANCE_ROWS,
    select: { user_id: true, status: true },
  });

  const firstStatus = new Map<string, string>();
  for (const r of rows) if (!firstStatus.has(r.user_id)) firstStatus.set(r.user_id, r.status);

  const counts: StatusCounts = { present: 0, late: 0, absent: 0 };
  firstStatus.forEach((status) => {
    if (status === "present") counts.present += 1;
    else if (status === "late") counts.late += 1;
    else if (status === "absent") counts.absent += 1;
  });
  return { ...counts, total: counts.present + counts.late + counts.absent };
}

/** Fallback: today's per-class head counts (class_attendance) against each class's enrolment. */
async function readAttendanceFromClassCounts(
  schoolId: string,
  dateOnly: Date,
): Promise<StatusCounts & { total: number }> {
  const rows = await prisma.class_attendance.findMany({
    where: { date: dateOnly, classes: { school_id: schoolId } },
    take: MAX_CLASSES,
    select: { students_present: true, classes: { select: { total_students: true } } },
  });

  let present = 0;
  let total = 0;
  for (const r of rows) {
    present += r.students_present;
    total += r.classes.total_students ?? 0;
  }
  present = Math.min(present, total); // a head count above enrolment is bad data, not >100%
  return { present, late: 0, absent: total - present, total };
}

/** Up to the last 7 days that have class_attendance rows, summed across the school, oldest first. */
async function readAttendanceTrend(schoolId: string): Promise<AdminAttendanceDay[]> {
  const latestDates = await prisma.class_attendance.groupBy({
    by: ["date"],
    where: { classes: { school_id: schoolId } },
    orderBy: { date: "desc" },
    take: TREND_DAYS,
  });
  if (latestDates.length === 0) return [];

  const rows = await prisma.class_attendance.findMany({
    where: { date: { in: latestDates.map((d) => d.date) }, classes: { school_id: schoolId } },
    take: TREND_DAYS * MAX_CLASSES,
    select: { date: true, students_present: true, classes: { select: { total_students: true } } },
  });

  const byDate = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const entry = byDate.get(key) ?? { present: 0, total: 0 };
    entry.present += r.students_present;
    entry.total += r.classes.total_students ?? 0;
    byDate.set(key, entry);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { present, total }]) => {
      const capped = Math.min(present, total);
      return { date, present: capped, total, rate: attendanceRate(capped, total) ?? 0 };
    });
}

/** Per-class numbers: live headcount, present today, and the class's average score/grade. */
async function readClassPerformance(schoolId: string): Promise<AdminClassPerformance[]> {
  const [classes, studentCounts, perfRows] = await Promise.all([
    prisma.classes.findMany({
      where: { school_id: schoolId },
      orderBy: [{ class_name: "asc" }, { stream: "asc" }],
      take: MAX_CLASSES,
      select: {
        id: true,
        class_name: true,
        stream: true,
        class_performance: true,
        students_present_today: true,
      },
    }),
    prisma.students.groupBy({
      by: ["class_id"],
      where: { school_id: schoolId, class_id: { not: null } },
      _count: { _all: true },
    }),
    prisma.class_subject_performance.findMany({
      where: { classes: { school_id: schoolId } },
      take: MAX_PERFORMANCE_ROWS,
      select: { class_id: true, average_score: true, average_grade: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const g of studentCounts) if (g.class_id) countMap.set(g.class_id, g._count._all);

  const scoresByClass = new Map<string, number[]>();
  const gradesByClass = new Map<string, string[]>();
  for (const p of perfRows) {
    const score = toNumber(p.average_score);
    if (score !== null) scoresByClass.set(p.class_id, [...(scoresByClass.get(p.class_id) ?? []), score]);
    if (p.average_grade) gradesByClass.set(p.class_id, [...(gradesByClass.get(p.class_id) ?? []), p.average_grade]);
  }

  const result = classes.map((c): AdminClassPerformance => {
    const scores = scoresByClass.get(c.id) ?? [];
    // The stored class average wins; the mean of the subject averages is the fallback.
    const stored = toNumber(c.class_performance);
    const fromSubjects = scores.length ? round1(scores.reduce((sum, n) => sum + n, 0) / scores.length) : null;
    return {
      classId: c.id,
      className: classLabel(c) ?? c.class_name,
      studentCount: countMap.get(c.id) ?? 0,
      presentToday: c.students_present_today,
      averageScore: stored ?? fromSubjects,
      averageGrade: mostCommon(gradesByClass.get(c.id) ?? []),
    };
  });

  // Best-performing classes first; classes without a score last.
  return result.sort((a, b) => {
    if (a.averageScore === null && b.averageScore === null) return a.className.localeCompare(b.className);
    if (a.averageScore === null) return 1;
    if (b.averageScore === null) return -1;
    return b.averageScore - a.averageScore || a.className.localeCompare(b.className);
  });
}

/** The newest grade reports of the school, with student, class and subject names joined in. */
async function readRecentGrades(schoolId: string): Promise<AdminRecentGrade[]> {
  const reports = await prisma.grading_reports.findMany({
    // grading_reports has no school_id; its class does.
    where: { classes: { school_id: schoolId } },
    orderBy: { created_at: { sort: "desc", nulls: "last" } },
    take: RECENT_GRADES_LIMIT,
    select: {
      id: true,
      student_id: true,
      term: true,
      grade: true,
      normalized_pct: true,
      created_at: true,
      classes: { select: { class_name: true, stream: true } },
      subjects: { select: { subject_name: true } },
    },
  });
  if (reports.length === 0) return [];

  const students = await prisma.students.findMany({
    where: { id: { in: Array.from(new Set(reports.map((r) => r.student_id))) }, school_id: schoolId },
    select: { id: true, first_name: true, last_name: true },
  });
  const names = new Map(students.map((s) => [s.id, fullName(s.first_name, s.last_name)]));

  return reports.map((r) => ({
    id: r.id,
    studentName: names.get(r.student_id) ?? "Student",
    className: classLabel(r.classes),
    subject: r.subjects?.subject_name ?? "Subject",
    term: r.term,
    grade: r.grade,
    normalizedPct: toNumber(r.normalized_pct),
    createdAt: toIso(r.created_at),
  }));
}

/** Newest students and teachers, as feed items (newest first). */
async function readNewPeopleActivity(schoolId: string): Promise<AdminActivityItem[]> {
  const [students, teachers] = await Promise.all([
    prisma.students.findMany({
      where: { school_id: schoolId },
      orderBy: { created_at: "desc" },
      take: ACTIVITY_LIMIT,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        created_at: true,
        classes: { select: { class_name: true, stream: true } },
      },
    }),
    prisma.teachers.findMany({
      where: { school_id: schoolId, created_at: { not: null } },
      orderBy: { created_at: "desc" },
      take: ACTIVITY_LIMIT,
      select: { id: true, name: true, created_at: true },
    }),
  ]);

  const items: AdminActivityItem[] = [];
  for (const s of students) {
    items.push({
      id: `student:${s.id}`,
      kind: "student",
      title: `New student: ${fullName(s.first_name, s.last_name) || "Unnamed"}`,
      detail: classLabel(s.classes),
      at: s.created_at.toISOString(),
    });
  }
  for (const t of teachers) {
    if (!t.created_at) continue;
    items.push({
      id: `teacher:${t.id}`,
      kind: "teacher",
      title: `New teacher: ${t.name}`,
      detail: null,
      at: t.created_at.toISOString(),
    });
  }
  return items;
}

/**
 * Build the whole overview for one school.
 *
 * Why it exists: the principal's home page is one screen of numbers; one call feeds all of it.
 * The caller (the route) wraps this in the per-school cache, so it may run at most once a minute.
 *
 * @param schoolId the session's school id (NEVER a value from the request)
 * @returns AdminOverviewData (JSON-safe)
 * @throws ApiError 404 when the school does not exist
 */
export async function getAdminOverview(schoolId: string): Promise<AdminOverviewData> {
  const day = getNairobiDay();

  const [school, students, teachers, classes, subjects, parents] = await Promise.all([
    prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
    prisma.students.count({ where: { school_id: schoolId } }),
    prisma.teachers.count({ where: { school_id: schoolId } }),
    prisma.classes.count({ where: { school_id: schoolId } }),
    prisma.school_subjects.count({ where: { school_id: schoolId, status: "active" } }),
    prisma.parent.count({ where: { school_id: schoolId } }),
  ]);
  if (!school) throw notFound("School not found.");

  const [logAttendance, attendanceTrend, classPerformance, recentGrades, newPeople] = await Promise.all([
    readAttendanceFromLog(schoolId, day.start, day.end),
    readAttendanceTrend(schoolId),
    readClassPerformance(schoolId),
    readRecentGrades(schoolId),
    readNewPeopleActivity(schoolId),
  ]);

  // Prefer the per-student log; fall back to today's class head counts; else say "none".
  let attendanceToday: AdminOverviewData["attendanceToday"];
  if (logAttendance.total > 0) {
    attendanceToday = {
      ...logAttendance,
      rate: attendanceRate(logAttendance.present + logAttendance.late, logAttendance.total),
      source: "attendance",
    };
  } else {
    const fromClasses = await readAttendanceFromClassCounts(schoolId, day.dateOnly);
    attendanceToday =
      fromClasses.total > 0
        ? { ...fromClasses, rate: attendanceRate(fromClasses.present, fromClasses.total), source: "class_attendance" }
        : { present: 0, late: 0, absent: 0, total: 0, rate: null, source: "none" };
  }

  const gradeActivity: AdminActivityItem[] = recentGrades
    .filter((g): g is AdminRecentGrade & { createdAt: string } => g.createdAt !== null)
    .map((g) => ({
      id: `grade:${g.id}`,
      kind: "grade",
      title: `${g.studentName}: ${g.grade} in ${g.subject}`,
      detail: [g.term, g.className].filter(Boolean).join(" - ") || null,
      at: g.createdAt,
    }));

  const recentActivity = [...gradeActivity, ...newPeople]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, ACTIVITY_LIMIT);

  return {
    generatedAt: new Date().toISOString(),
    school: { id: school.id, name: school.name },
    totals: { students, teachers, classes, subjects, parents },
    attendanceToday,
    attendanceTrend,
    classPerformance,
    recentGrades,
    recentActivity,
  };
}
