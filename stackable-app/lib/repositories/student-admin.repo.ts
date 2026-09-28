// =============================================================================
// Student admin repository (Prisma / Neon) — the school-admin view of students.
// -----------------------------------------------------------------------------
// Implements StudentAdminStore with Prisma + PostgreSQL. Rows go through
// lib/mappers/student-admin.mapper.ts so the JSON is plain (no Date/BigInt).
// Every query is scoped by schoolId.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { dateOnlyToDate } from "@/lib/admin-normalize";
import { averagePointsFromCounts } from "@/lib/grade-points";
import {
  buildStatusCounts,
  toStudentClassOptions,
  toStudentListItem,
  toStudentProfile,
} from "@/lib/mappers/student-admin.mapper";
import {
  MAX_STUDENTS_PER_LIST,
  STUDENT_STATUSES,
  type StudentListData,
} from "@/lib/dto/students";
import type { StudentAdminStore, StudentFieldChanges } from "@/lib/services/student-admin.store";

const LIST_SELECT = {
  id: true,
  user_id: true,
  school_id: true,
  school_name: true,
  admission_no: true,
  first_name: true,
  last_name: true,
  class_id: true,
  date_of_birth: true,
  phone: true,
  phone2: true,
  email: true,
  profile_picture: true,
  status: true,
  average_grade: true,
  created_at: true,
  classes: { select: { class_name: true, stream: true } },
} as const;

async function classRows(schoolId: string) {
  return prisma.classes.findMany({
    where: { school_id: schoolId },
    select: { id: true, class_name: true, stream: true },
    take: 500,
  });
}

async function schoolRows(schoolId: string) {
  const school = await prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } });
  return school ? [school] : [];
}

export const studentAdminPrismaStore: StudentAdminStore = {
  async list(schoolId) {
    const [rows, classes, schools, statusGroups, parentGroups] = await Promise.all([
      prisma.students.findMany({
        where: { school_id: schoolId },
        orderBy: { created_at: "desc" },
        take: MAX_STUDENTS_PER_LIST,
        select: LIST_SELECT,
      }),
      classRows(schoolId),
      schoolRows(schoolId),
      prisma.students.groupBy({ by: ["status"], where: { school_id: schoolId }, _count: { _all: true } }),
      prisma.student_parents.groupBy({ by: ["student_id"], where: { school_id: schoolId }, _count: { _all: true } }),
    ]);

    const parentsByStudent = new Map(parentGroups.map((group) => [group.student_id, group._count._all]));
    const counts = buildStatusCounts(statusGroups.map((group) => ({ status: group.status, count: group._count._all })));

    const data: StudentListData = {
      students: rows.map((row) => toStudentListItem(row, row.classes, parentsByStudent.get(row.id) ?? 0)),
      total: counts.all,
      truncated: counts.all > MAX_STUDENTS_PER_LIST,
      counts,
      classes: toStudentClassOptions(classes),
      schools,
    };
    return data;
  },

  async getListItem(schoolId, studentId) {
    const row = await prisma.students.findFirst({
      where: { id: studentId, school_id: schoolId },
      select: LIST_SELECT,
    });
    if (!row) return null;
    const parents = await prisma.student_parents.count({ where: { student_id: studentId, school_id: schoolId } });
    return toStudentListItem(row, row.classes, parents);
  },

  async getProfile(schoolId, studentId) {
    const student = await prisma.students.findFirst({
      where: { id: studentId, school_id: schoolId },
      select: {
        ...LIST_SELECT,
        class_teacher_id: true,
        location: true,
        home_address: true,
        emergency_contact: true,
        health_status: true,
        other_info: true,
        activity: true,
        teachers: { select: { id: true, name: true } },
        users: { select: { first_name: true, last_name: true, email: true, phone: true } },
      },
    });
    if (!student) return null;

    const [links, subjectRows, gradeGroups, recentReports, attendanceGroups] = await Promise.all([
      prisma.student_parents.findMany({
        where: { student_id: studentId, school_id: schoolId },
        take: 20,
        select: {
          relationship: true,
          is_primary: true,
          primary_role: true,
          parent: {
            select: {
              id: true,
              phone: true,
              alternate_phone: true,
              status: true,
              users: { select: { first_name: true, last_name: true, email: true } },
            },
          },
        },
      }),
      prisma.student_subjects.findMany({
        where: { student_id: studentId, is_active: true },
        take: 100,
        select: { subject_id: true, teacher_id: true, subjects: { select: { subject_name: true } } },
      }),
      prisma.grading_reports.groupBy({ by: ["grade"], where: { student_id: studentId }, _count: { _all: true } }),
      prisma.grading_reports.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          subject_id: true,
          term: true,
          grade: true,
          raw_score: true,
          normalized_pct: true,
          created_at: true,
          subjects: { select: { subject_name: true } },
        },
      }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { school_id: schoolId, user_id: student.user_id, user_type: "student" },
        _count: { _all: true },
      }),
    ]);

    // Teacher names for the subject list, one query.
    const teacherIds = Array.from(
      new Set(subjectRows.map((row) => row.teacher_id).filter((id): id is string => Boolean(id))),
    );
    const teachers = teacherIds.length
      ? await prisma.teachers.findMany({
          where: { id: { in: teacherIds }, school_id: schoolId },
          select: { id: true, name: true },
        })
      : [];
    const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));

    return toStudentProfile({
      student,
      classItem: student.classes,
      classTeacher: student.teachers,
      account: student.users,
      guardians: links.map((link) => ({
        parent_id: link.parent.id,
        first_name: link.parent.users.first_name,
        last_name: link.parent.users.last_name,
        email: link.parent.users.email,
        phone: link.parent.phone,
        alternate_phone: link.parent.alternate_phone,
        relationship: link.relationship,
        is_primary: link.is_primary,
        primary_role: link.primary_role,
        status: link.parent.status,
      })),
      subjects: subjectRows.map((row) => ({
        subject_id: row.subject_id,
        subject_name: row.subjects.subject_name,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_id ? (teacherNames.get(row.teacher_id) ?? null) : null,
      })),
      recentGrades: recentReports.map((report) => ({
        subject_id: report.subject_id,
        subject_name: report.subjects.subject_name,
        term: report.term,
        grade: report.grade,
        raw_score: report.raw_score,
        normalized_pct: report.normalized_pct,
        created_at: report.created_at,
      })),
      avgScore: averagePointsFromCounts(gradeGroups.map((group) => ({ grade: group.grade, count: group._count._all }))),
      attendance: attendanceGroups.map((group) => ({ status: group.status, count: group._count._all })),
    });
  },

  async formOptions(schoolId) {
    const [classes, schools] = await Promise.all([classRows(schoolId), schoolRows(schoolId)]);
    return { classes: toStudentClassOptions(classes), schools, statuses: STUDENT_STATUSES };
  },

  async classExists(schoolId, classId) {
    const found = await prisma.classes.findFirst({ where: { id: classId, school_id: schoolId }, select: { id: true } });
    return found !== null;
  },

  async update(schoolId, studentId, changes: StudentFieldChanges) {
    const { date_of_birth, ...rest } = changes;
    const result = await prisma.students.updateMany({
      where: { id: studentId, school_id: schoolId },
      data: {
        ...rest,
        ...(date_of_birth !== undefined
          ? { date_of_birth: date_of_birth === null ? null : dateOnlyToDate(date_of_birth) }
          : {}),
      },
    });
    return result.count === 1;
  },

  async remove(schoolId, studentId) {
    const result = await prisma.students.deleteMany({ where: { id: studentId, school_id: schoolId } });
    return result.count === 1;
  },
};
