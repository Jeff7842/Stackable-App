// =============================================================================
// Teacher portal repository — what a teacher sees on their home page, their
// student list and a single student's profile.
// -----------------------------------------------------------------------------
// Security:
//   * The teacher is resolved from the SESSION user (email lookup, because
//     `teachers` has no user_id) and must belong to the session's school.
//   * A teacher only ever sees students assigned to them (teacher_student_assignments).
//   * Nothing here trusts an id from the request except the studentId of the
//     profile page, which is checked against the assignments first.
// It lives in its own file (not teacher.repo.ts) to keep the shared admin-side
// teacher repository untouched.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import type {
  TeacherAttentionItem,
  TeacherClassCard,
  TeacherGradeEntry,
  TeacherPortalData,
  TeacherStudent,
  TeacherStudentProfile,
} from "./portal-types";
import {
  MAX_ASSIGNED_STUDENTS,
  TIMETABLE_SELECT,
  attendanceRateOrNull,
  buildAttendanceSummary,
  buildTodaySchedule,
  classLabel,
  fullName,
  getNairobiDay,
  getPctStatsByStudent,
  getStudentAttendanceSummaries,
  loadStudentReports,
  meanPct,
  toGradeRows,
  toIso,
  toLessonSlot,
  toNumber,
} from "./portal-shared";

// Contract types, re-exported for convenience.
export type {
  TeacherAttentionItem,
  TeacherClassCard,
  TeacherGradeEntry,
  TeacherPortalData,
  TeacherStudent,
  TeacherStudentProfile,
} from "./portal-types";

const LOW_AVERAGE_PCT = 50; // a mean below 50% puts a student on the attention list
const ATTENTION_LIMIT = 6; // the home page shows at most 6 students needing attention
const RECENT_GRADING_LIMIT = 6; // ...and the teacher's last 6 grade entries
const MAX_TIMETABLE_ROWS = 400; // a teacher's whole week is ~40 slots; safety cap
const MAX_SUBJECTS_PER_TEACHER = 100; // safety cap

type ResolvedTeacher = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  school_id: string;
  schoolName: string | null;
};

/**
 * Find the teacher row for the signed-in user.
 *
 * Why it exists: `teachers` has no user_id, so the link is the shared email. Emails are
 * only unique per school in `users`, so we also require the teacher to be in the
 * session's school (otherwise a same-email user in another school could match).
 *
 * @param userId   the signed-in user's id (from the session)
 * @param schoolId the session's school id
 * @throws ApiError 404 when the user has no email or no teacher profile in this school
 */
export async function resolveTeacher(userId: string, schoolId: string): Promise<ResolvedTeacher> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) {
    throw notFound("User account has no email — cannot resolve teacher profile.");
  }

  const teacher = await prisma.teachers.findUnique({
    where: { email: user.email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      school_id: true,
      schools: { select: { name: true } },
    },
  });
  if (!teacher || teacher.school_id !== schoolId) {
    throw notFound("No teacher profile found for this account.");
  }

  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    status: teacher.status,
    school_id: teacher.school_id,
    schoolName: teacher.schools?.name ?? null,
  };
}

/**
 * Everything the teacher home page needs, in a fixed number of queries (no N+1).
 *
 * Why it exists: the home page shows classes, today's lessons, recent grading and the
 * students who need attention; one request keeps it fast.
 *
 * @param userId   the signed-in user's id (from the session)
 * @param schoolId the session's school id
 * @returns TeacherPortalData
 * @throws ApiError 404 when there is no teacher profile for this account
 */
export async function getTeacherPortalData(userId: string, schoolId: string): Promise<TeacherPortalData> {
  const teacher = await resolveTeacher(userId, schoolId);
  const day = getNairobiDay();

  const [timetableRows, assignments, teacherSubjects, recentReports] = await Promise.all([
    // The teacher's whole timetable: gives the class list AND today's lessons.
    prisma.teacher_timetables.findMany({
      where: { teacher_id: teacher.id, school_id: teacher.school_id },
      orderBy: { start_time: "asc" },
      take: MAX_TIMETABLE_ROWS,
      select: { ...TIMETABLE_SELECT, day_of_week: true },
    }),
    // Students assigned to this teacher (one row per student).
    prisma.teacher_student_assignments.findMany({
      where: { teacher_id: teacher.id, school_id: teacher.school_id },
      distinct: ["student_id"],
      take: MAX_ASSIGNED_STUDENTS,
      select: {
        student_id: true,
        students: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            classes: { select: { class_name: true, stream: true } },
          },
        },
      },
    }),
    prisma.teacher_subjects.findMany({
      where: { teacher_id: teacher.id, school_id: teacher.school_id },
      distinct: ["subject_id"],
      take: MAX_SUBJECTS_PER_TEACHER,
      select: { subjects: { select: { id: true, subject_name: true } } },
    }),
    // grading_reports has no school_id: the teacher (school-verified above) is the ownership chain.
    prisma.grading_reports.findMany({
      where: { teacher_id: teacher.id },
      orderBy: { created_at: { sort: "desc", nulls: "last" } },
      take: RECENT_GRADING_LIMIT,
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
    }),
  ]);

  const classIds = Array.from(
    new Set(timetableRows.map((r) => r.class_id).filter((id): id is string => id !== null)),
  );
  const assignedIds = assignments.map((a) => a.student_id);
  const gradedStudentIds = Array.from(new Set(recentReports.map((r) => r.student_id)));

  const [classes, liveCounts, gradedStudents, pctStats] = await Promise.all([
    prisma.classes.findMany({
      where: { id: { in: classIds }, school_id: teacher.school_id },
      select: {
        id: true,
        class_name: true,
        stream: true,
        total_students: true,
        students_present_today: true,
      },
    }),
    prisma.students.groupBy({
      by: ["class_id"],
      where: { school_id: teacher.school_id, class_id: { in: classIds } },
      _count: { _all: true },
    }),
    prisma.students.findMany({
      where: { id: { in: gradedStudentIds }, school_id: teacher.school_id },
      select: { id: true, first_name: true, last_name: true },
    }),
    getPctStatsByStudent(assignedIds),
  ]);

  const liveCountMap = new Map<string, number>();
  for (const g of liveCounts) if (g.class_id) liveCountMap.set(g.class_id, g._count._all);
  const classLabelById = new Map(classes.map((c) => [c.id, classLabel(c)]));

  const classCards: TeacherClassCard[] = classes.map((c) => ({
    id: c.id,
    name: c.class_name,
    stream: c.stream,
    totalStudents: c.total_students,
    studentCount: liveCountMap.get(c.id) ?? 0,
    presentToday: c.students_present_today,
  }));

  // Today's lessons = this teacher's rows for today's weekday (day names are compared case-insensitively).
  const todayLessons = timetableRows
    .filter((r) => r.day_of_week.toLowerCase() === day.weekday.toLowerCase())
    .map((r) => toLessonSlot(r, r.class_id ? classLabelById.get(r.class_id) ?? null : null));

  const gradedNames = new Map(gradedStudents.map((s) => [s.id, fullName(s.first_name, s.last_name)]));
  const recentGrading: TeacherGradeEntry[] = recentReports.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: gradedNames.get(r.student_id) ?? "Student",
    className: classLabel(r.classes),
    subject: r.subjects?.subject_name ?? "Subject",
    term: r.term,
    grade: r.grade,
    normalizedPct: toNumber(r.normalized_pct),
    createdAt: toIso(r.created_at),
  }));

  // Attention list: low averages first (lowest first), then students with no reports at all.
  const lowAverage: TeacherAttentionItem[] = [];
  const noGrades: TeacherAttentionItem[] = [];
  for (const a of assignments) {
    const s = a.students;
    const stats = pctStats.get(s.id);
    const base = { studentId: s.id, name: fullName(s.first_name, s.last_name), className: classLabel(s.classes) };
    if (!stats || stats.reportCount === 0) {
      noGrades.push({ ...base, averagePct: null, reason: "no-grades" });
    } else if (stats.averagePct !== null && stats.averagePct < LOW_AVERAGE_PCT) {
      lowAverage.push({ ...base, averagePct: stats.averagePct, reason: "low-average" });
    }
  }
  lowAverage.sort((a, b) => (a.averagePct ?? 0) - (b.averagePct ?? 0));
  noGrades.sort((a, b) => a.name.localeCompare(b.name));

  return {
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, status: teacher.status },
    schoolName: teacher.schoolName,
    classes: classCards,
    subjects: teacherSubjects.map((ts) => ({
      id: String(ts.subjects.id),
      subjectName: ts.subjects.subject_name,
    })),
    studentCount: assignments.length,
    today: buildTodaySchedule(day, todayLessons),
    recentGrading,
    attention: [...lowAverage, ...noGrades].slice(0, ATTENTION_LIMIT),
  };
}

/**
 * The students assigned to the signed-in teacher, with average and attendance.
 *
 * Why it exists: the teacher's student list shows how each student is doing at a glance;
 * averages and attendance are computed in batch for the whole list.
 *
 * @param userId   the signed-in user's id (from the session)
 * @param schoolId the session's school id
 * @returns the list (sorted by last name) and its length
 * @throws ApiError 404 when there is no teacher profile for this account
 */
export async function listTeacherStudents(
  userId: string,
  schoolId: string,
): Promise<{ students: TeacherStudent[]; total: number }> {
  const teacher = await resolveTeacher(userId, schoolId);

  const assignments = await prisma.teacher_student_assignments.findMany({
    where: { teacher_id: teacher.id, school_id: teacher.school_id },
    distinct: ["student_id"],
    orderBy: { students: { last_name: "asc" } },
    take: MAX_ASSIGNED_STUDENTS,
    select: {
      students: {
        select: {
          id: true,
          user_id: true,
          school_id: true,
          first_name: true,
          last_name: true,
          admission_no: true,
          status: true,
          class_id: true,
          profile_picture: true,
          average_grade: true,
          classes: { select: { class_name: true, stream: true } },
        },
      },
    },
  });

  const students = assignments.map((a) => a.students);
  const [pctStats, attendance] = await Promise.all([
    getPctStatsByStudent(students.map((s) => s.id)),
    getStudentAttendanceSummaries(students.map((s) => ({ userId: s.user_id, schoolId: s.school_id }))),
  ]);

  const list: TeacherStudent[] = students.map((s) => ({
    id: s.id,
    firstName: s.first_name ?? "",
    lastName: s.last_name,
    admissionNo: s.admission_no,
    status: s.status,
    classId: s.class_id,
    className: classLabel(s.classes),
    profilePicture: s.profile_picture,
    averageGrade: s.average_grade,
    averagePct: pctStats.get(s.id)?.averagePct ?? null,
    attendanceRate: attendanceRateOrNull(attendance.get(s.user_id)),
  }));

  return { students: list, total: list.length };
}

/**
 * One student's profile for a teacher — ONLY if the student is assigned to that teacher.
 *
 * Why it exists: the teacher's student page; the assignment check is the access rule, and a
 * student who is not assigned looks exactly like one that does not exist (404), so the
 * endpoint cannot be used to probe for ids.
 *
 * Deliberately excludes address, health, emergency-contact and phone data.
 *
 * @param userId    the signed-in user's id (from the session)
 * @param schoolId  the session's school id
 * @param studentId the student's id from the URL (already checked to be a UUID by the route)
 * @throws ApiError 404 when there is no teacher profile, the student is not assigned to this
 *         teacher, or the student does not exist in this school
 */
export async function getTeacherStudentProfile(
  userId: string,
  schoolId: string,
  studentId: string,
): Promise<TeacherStudentProfile> {
  const teacher = await resolveTeacher(userId, schoolId);

  const assignment = await prisma.teacher_student_assignments.findFirst({
    where: { teacher_id: teacher.id, student_id: studentId, school_id: teacher.school_id },
    select: { id: true },
  });
  if (!assignment) throw notFound("Student not found.");

  const student = await prisma.students.findFirst({
    where: { id: studentId, school_id: teacher.school_id },
    select: {
      id: true,
      user_id: true,
      school_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      status: true,
      class_id: true,
      profile_picture: true,
      average_grade: true,
      date_of_birth: true,
      email: true,
      classes: { select: { class_name: true, stream: true } },
    },
  });
  if (!student) throw notFound("Student not found.");

  const [reports, attendance] = await Promise.all([
    loadStudentReports(student.id),
    getStudentAttendanceSummaries([{ userId: student.user_id, schoolId: student.school_id }]),
  ]);

  return {
    student: {
      id: student.id,
      firstName: student.first_name ?? "",
      lastName: student.last_name,
      admissionNo: student.admission_no,
      status: student.status,
      classId: student.class_id,
      className: classLabel(student.classes),
      profilePicture: student.profile_picture,
      averageGrade: student.average_grade,
      averagePct: meanPct(reports.map((r) => r.normalizedPct)),
      dateOfBirth: toIso(student.date_of_birth)?.slice(0, 10) ?? null,
      email: student.email,
    },
    grades: toGradeRows(reports),
    attendance:
      attendance.get(student.user_id) ?? buildAttendanceSummary({ present: 0, late: 0, absent: 0 }),
  };
}
