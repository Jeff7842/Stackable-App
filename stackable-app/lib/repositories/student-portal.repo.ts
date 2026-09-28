// =============================================================================
// Student portal repository — everything a student sees about THEMSELVES on the
// portal home and the grades page.
// -----------------------------------------------------------------------------
// Security: every function starts from the logged-in student's userId, finds that
// student's own row and only returns data scoped to that student (and that
// student's school). The implementation lives here (not in student.repo.ts) so the
// shared student.repo.ts stays a thin, low-conflict file; student.repo.ts's
// getStudentDashboard / getStudentGrades delegate to the two functions below.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import type { GradeRow, StudentDashboardData } from "./portal-types";
import {
  classLabel,
  getNairobiDay,
  getStudentAttendanceSummaries,
  loadActiveSubjects,
  loadClassSchedule,
  loadStudentReports,
  summarizeSubjects,
  toGradeRows,
} from "./portal-shared";

/** Find the student row (with the joins the dashboard needs) for a logged-in user. */
async function findStudentForUser(userId: string) {
  const student = await prisma.students.findUnique({
    where: { user_id: userId },
    select: {
      id: true,
      user_id: true,
      school_id: true,
      class_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      average_grade: true,
      profile_picture: true,
      status: true,
      // The student's own class teacher; falls back to the class's teacher below.
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
  if (!student) throw notFound("No student profile found for this account.");
  return student;
}

/**
 * Full home-page data for the logged-in student.
 *
 * Why it exists: one request gives the portal home its stat cards, subject list,
 * recent grades, attendance ring and today's lesson rail.
 *
 * @param userId the signed-in user's id (from the session, never from the request)
 * @returns StudentDashboardData (see portal-types.ts for each field's meaning)
 * @throws ApiError 404 when the account has no student profile
 */
export async function loadStudentDashboard(userId: string): Promise<StudentDashboardData> {
  const student = await findStudentForUser(userId);
  const className = classLabel(student.classes);
  const day = getNairobiDay();

  const [reports, subjectRows, attendance, today] = await Promise.all([
    loadStudentReports(student.id),
    loadActiveSubjects(student.id, student.school_id),
    getStudentAttendanceSummaries([{ userId: student.user_id, schoolId: student.school_id }]),
    loadClassSchedule(student.school_id, student.class_id, className, day),
  ]);

  const subjects = summarizeSubjects(subjectRows, reports);

  return {
    student: {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
      admissionNo: student.admission_no,
      className,
      averageGrade: student.average_grade,
      status: student.status,
      profilePicture: student.profile_picture,
      classTeacherName:
        student.teachers?.name ??
        student.classes?.teachers_classes_class_teacher_idToteachers?.name ??
        null,
    },
    subjectCount: subjects.length,
    grades: toGradeRows(reports),
    // getStudentAttendanceSummaries always returns an entry for every requested user.
    attendance: attendance.get(student.user_id) ?? {
      present: 0,
      late: 0,
      absent: 0,
      total: 0,
      rate: 0,
    },
    subjects,
    today,
  };
}

/**
 * Just the grades list for the logged-in student (the grades page).
 *
 * @param userId the signed-in user's id (from the session)
 * @returns GradeRow[], newest term first
 * @throws ApiError 404 when the account has no student profile
 */
export async function loadStudentGrades(userId: string): Promise<GradeRow[]> {
  const student = await prisma.students.findUnique({
    where: { user_id: userId },
    select: { id: true },
  });
  if (!student) throw notFound("No student profile found for this account.");

  return toGradeRows(await loadStudentReports(student.id));
}
