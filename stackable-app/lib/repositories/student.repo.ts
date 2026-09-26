// =============================================================================
// Student repository — data a student is allowed to see about THEMSELVES.
// -----------------------------------------------------------------------------
// Security: every function starts from the logged-in student's userId, finds
// the student's own row, and only ever returns data scoped to that student.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";

export type StudentDashboardData = {
  student: {
    id: string;
    firstName: string | null;
    lastName: string;
    admissionNo: string;
    className: string | null;
    averageGrade: string | null;
    status: string;
  };
  subjectCount: number;
  grades: Array<{
    subject: string;
    term: string;
    grade: string;
    rawScore: number | null;
    normalizedPct: number | null;
  }>;
  attendance: {
    present: number;
    late: number;
    absent: number;
    total: number;
    rate: number;
  };
};

function classLabel(c: { class_name: string; stream: string | null } | null): string | null {
  if (!c) return null;
  return c.stream ? `${c.class_name} ${c.stream}` : c.class_name;
}

/** Find the student row for a logged-in user. Throws if they aren't a student. */
async function getStudentByUser(userId: string) {
  const student = await prisma.students.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      user_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      average_grade: true,
      status: true,
      classes: { select: { class_name: true, stream: true } },
    },
  });
  if (!student) throw notFound("No student profile found for this account.");
  return student;
}

/** Full dashboard data for the logged-in student. */
export async function getStudentDashboard(userId: string): Promise<StudentDashboardData> {
  const student = await getStudentByUser(userId);

  const [subjectCountResult, reports, attendanceRows] = await Promise.all([
    prisma.student_subjects.count({
      where: { student_id: student.id, is_active: true },
    }),
    prisma.grading_reports.findMany({
      where: { student_id: student.id },
      orderBy: [{ term: "desc" }],
      select: {
        subject_id: true,
        term: true,
        grade: true,
        raw_score: true,
        normalized_pct: true,
      },
    }),
    prisma.attendance.findMany({
      where: { user_id: student.user_id, user_type: "student" },
      select: { status: true },
    }),
  ]);

  // Resolve subject names in one query.
  const subjectIds = Array.from(new Set(reports.map((r) => r.subject_id)));
  const subjects = subjectIds.length
    ? await prisma.subjects.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, subject_name: true },
      })
    : [];
  const subjectMap = new Map(subjects.map((s) => [String(s.id), s.subject_name]));

  const counts = { present: 0, late: 0, absent: 0 };
  for (const a of attendanceRows) {
    if (a.status === "present") counts.present += 1;
    else if (a.status === "late") counts.late += 1;
    else if (a.status === "absent") counts.absent += 1;
  }
  const total = counts.present + counts.late + counts.absent;
  const rate = total === 0 ? 0 : Math.round(((counts.present + counts.late) / total) * 100);

  return {
    student: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      admissionNo: student.admission_no,
      className: classLabel(student.classes),
      averageGrade: student.average_grade,
      status: student.status,
    },
    subjectCount: subjectCountResult,
    grades: reports.map((r) => ({
      subject: subjectMap.get(String(r.subject_id)) ?? `Subject ${r.subject_id}`,
      term: r.term,
      grade: r.grade,
      rawScore: r.raw_score == null ? null : Number(r.raw_score),
      normalizedPct: r.normalized_pct == null ? null : Number(r.normalized_pct),
    })),
    attendance: { ...counts, total, rate },
  };
}

/** Just the grades list for the logged-in student — used by the grades page. */
export async function getStudentGrades(
  userId: string,
): Promise<StudentDashboardData["grades"]> {
  const student = await getStudentByUser(userId);

  const reports = await prisma.grading_reports.findMany({
    where: { student_id: student.id },
    orderBy: [{ term: "desc" }],
    select: {
      subject_id: true,
      term: true,
      grade: true,
      raw_score: true,
      normalized_pct: true,
    },
  });

  const subjectIds = Array.from(new Set(reports.map((r) => r.subject_id)));
  const subjects = subjectIds.length
    ? await prisma.subjects.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, subject_name: true },
      })
    : [];
  const subjectMap = new Map(subjects.map((s) => [String(s.id), s.subject_name]));

  return reports.map((r) => ({
    subject: subjectMap.get(String(r.subject_id)) ?? `Subject ${r.subject_id}`,
    term: r.term,
    grade: r.grade,
    rawScore: r.raw_score == null ? null : Number(r.raw_score),
    normalizedPct: r.normalized_pct == null ? null : Number(r.normalized_pct),
  }));
}
