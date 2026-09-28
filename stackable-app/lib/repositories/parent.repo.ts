// =============================================================================
// Parent repository — data a parent is allowed to see about THEIR children.
// -----------------------------------------------------------------------------
// Security: every function starts from the logged-in parent's userId, finds the
// parent's own children via student_parents, and NEVER lets a parent read a
// child that isn't linked to them. (student_parents has no DB foreign key to
// students, so we fetch students by id ourselves.) Children are only read inside
// the parent's own school.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { forbidden, notFound } from "@/lib/api/errors";
import type { ChildCard, ChildOverview } from "./portal-types";
import {
  attendanceRateOrNull,
  classLabel,
  getPctStatsByStudent,
  getStudentAttendanceSummaries,
  loadActiveSubjects,
  loadStudentReports,
  meanPct,
  summarizeSubjects,
  toGradeRows,
  toIso,
  toNumber,
} from "./portal-shared";

// Contract types (see portal-types.ts); re-exported so existing imports keep working.
export type { ChildCard, ChildOverview } from "./portal-types";

/** A parent has a handful of children; this is a safety cap, not a real limit. */
const MAX_CHILDREN = 20;

/** Find the parent row for a logged-in user. Throws if they aren't a parent. */
async function getParentByUser(userId: string) {
  const parent = await prisma.parent.findUnique({ where: { user_id: userId } });
  if (!parent) throw notFound("No parent profile found for this account.");
  return parent;
}

/**
 * Cards for each child linked to this parent.
 *
 * Why it exists: the parent home shows one card per child with the numbers a
 * parent checks first (average, attendance, latest grade). Everything is computed
 * in batch for ALL children (no per-child query loop).
 *
 * @param userId the signed-in user's id (from the session)
 * @returns ChildCard[] (empty when no child is linked)
 * @throws ApiError 404 when the account has no parent profile
 */
export async function getParentChildren(userId: string): Promise<ChildCard[]> {
  const parent = await getParentByUser(userId);

  const links = await prisma.student_parents.findMany({
    where: { parent_id: parent.id, school_id: parent.school_id },
    orderBy: { created_at: "asc" },
    take: MAX_CHILDREN,
    select: { student_id: true, relationship: true, is_primary: true },
  });
  if (links.length === 0) return [];

  const studentIds = links.map((l) => l.student_id);
  const students = await prisma.students.findMany({
    where: { id: { in: studentIds }, school_id: parent.school_id },
    select: {
      id: true,
      user_id: true,
      school_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      profile_picture: true,
      average_grade: true,
      classes: { select: { class_name: true, stream: true } },
    },
  });
  const foundIds = students.map((s) => s.id);

  const [pctStats, subjectCounts, latestReports, attendance] = await Promise.all([
    getPctStatsByStudent(foundIds),
    prisma.student_subjects.groupBy({
      by: ["student_id"],
      where: { student_id: { in: foundIds }, is_active: true },
      _count: { _all: true },
    }),
    // First row per student in this order = that student's most recent report.
    prisma.grading_reports.findMany({
      where: { student_id: { in: foundIds } },
      orderBy: [{ created_at: { sort: "desc", nulls: "last" } }, { term: "desc" }],
      distinct: ["student_id"],
      select: {
        student_id: true,
        term: true,
        grade: true,
        normalized_pct: true,
        subjects: { select: { subject_name: true } },
      },
    }),
    getStudentAttendanceSummaries(students.map((s) => ({ userId: s.user_id, schoolId: s.school_id }))),
  ]);

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const subjectCountMap = new Map(subjectCounts.map((g) => [g.student_id, g._count._all]));
  const latestMap = new Map(latestReports.map((r) => [r.student_id, r]));

  return links
    .map((link): ChildCard | null => {
      const s = studentMap.get(link.student_id);
      if (!s) return null;
      const latest = latestMap.get(s.id);
      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        admissionNo: s.admission_no,
        className: classLabel(s.classes),
        profilePicture: s.profile_picture,
        averageGrade: s.average_grade,
        relationship: link.relationship,
        isPrimary: link.is_primary,
        subjectCount: subjectCountMap.get(s.id) ?? 0,
        averagePct: pctStats.get(s.id)?.averagePct ?? null,
        attendanceRate: attendanceRateOrNull(attendance.get(s.user_id)),
        latestGrade: latest
          ? {
              subject: latest.subjects?.subject_name ?? "Subject",
              term: latest.term,
              grade: latest.grade,
              normalizedPct: toNumber(latest.normalized_pct),
            }
          : null,
      };
    })
    .filter((x): x is ChildCard => x !== null);
}

/**
 * Full overview of ONE child — only if that child is linked to this parent.
 *
 * Why it exists: the child page shows grades, attendance and subjects for a single child.
 *
 * @param userId    the signed-in user's id (from the session)
 * @param studentId the child's id from the URL (validated by the route; checked against the links here)
 * @returns ChildOverview
 * @throws ApiError 403 when the child is not linked to this parent; 404 when there is no parent
 *         profile or the student row no longer exists
 */
export async function getChildOverview(
  userId: string,
  studentId: string,
): Promise<ChildOverview> {
  const parent = await getParentByUser(userId);

  const link = await prisma.student_parents.findFirst({
    where: { parent_id: parent.id, student_id: studentId, school_id: parent.school_id },
    select: { id: true },
  });
  if (!link) throw forbidden("This child is not linked to your account.");

  const student = await prisma.students.findFirst({
    where: { id: studentId, school_id: parent.school_id },
    select: {
      id: true,
      user_id: true,
      school_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      profile_picture: true,
      average_grade: true,
      date_of_birth: true,
      status: true,
      teachers: { select: { name: true } },
      classes: {
        select: {
          class_name: true,
          stream: true,
          teachers_classes_class_teacher_idToteachers: { select: { name: true } },
        },
      },
    },
  });
  if (!student) throw notFound("Student not found.");

  const [reports, subjectRows, attendance] = await Promise.all([
    loadStudentReports(student.id),
    loadActiveSubjects(student.id, student.school_id),
    getStudentAttendanceSummaries([{ userId: student.user_id, schoolId: student.school_id }]),
  ]);

  return {
    student: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      admissionNo: student.admission_no,
      className: classLabel(student.classes),
      profilePicture: student.profile_picture,
      status: student.status,
      averageGrade: student.average_grade,
      averagePct: meanPct(reports.map((r) => r.normalizedPct)),
      // @db.Date arrives as UTC midnight; keep just yyyy-mm-dd.
      dateOfBirth: toIso(student.date_of_birth)?.slice(0, 10) ?? null,
      classTeacherName:
        student.teachers?.name ??
        student.classes?.teachers_classes_class_teacher_idToteachers?.name ??
        null,
    },
    grades: toGradeRows(reports),
    attendance: attendance.get(student.user_id) ?? {
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      rate: 0,
    },
    subjects: summarizeSubjects(subjectRows, reports),
  };
}
