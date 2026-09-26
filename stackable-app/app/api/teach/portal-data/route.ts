// =============================================================================
// GET /api/teach/portal-data — Teacher portal dashboard data
// -----------------------------------------------------------------------------
// Scoped to the logged-in teacher. Because the `teachers` table has no user_id
// FK, we resolve the teacher by looking up the user's email in `users` and then
// finding the teacher row with that email (teachers.email is unique).
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse, notFound } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, {
      roles: ["teacher", "staff", "super-admin"],
      rateLimit: "read",
    });

    // Resolve teacher row via email (teachers has no user_id FK to users).
    const user = await prisma.users.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw notFound("User account has no email — cannot resolve teacher profile.");
    }

    const teacher = await prisma.teachers.findUnique({
      where: { email: user.email },
      select: { id: true, name: true, email: true, status: true, school_id: true },
    });

    if (!teacher) {
      throw notFound("No teacher profile found for this account.");
    }

    // Fetch all portal data in parallel.
    const [timetableRows, studentAssignments, teacherSubjects] = await Promise.all([
      // Timetable → unique class_ids this teacher is scheduled for
      prisma.teacher_timetables.findMany({
        where: { teacher_id: teacher.id },
        select: { class_id: true },
        distinct: ["class_id"],
      }),

      // Students assigned to this teacher
      prisma.teacher_student_assignments.findMany({
        where: { teacher_id: teacher.id },
        select: {
          student_id: true,
          students: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        distinct: ["student_id"],
      }),

      // Subjects assigned to this teacher
      prisma.teacher_subjects.findMany({
        where: { teacher_id: teacher.id },
        select: {
          subject_id: true,
          subjects: {
            select: {
              id: true,
              subject_name: true,
            },
          },
        },
        distinct: ["subject_id"],
      }),
    ]);

    // Resolve class details for the timetable class_ids
    const classIds = timetableRows
      .map((r) => r.class_id)
      .filter((id): id is string => id !== null);

    const classes =
      classIds.length > 0
        ? await prisma.classes.findMany({
            where: { id: { in: classIds } },
            select: {
              id: true,
              class_name: true,
              stream: true,
              total_students: true,
            },
          })
        : [];

    const subjects = teacherSubjects.map((ts) => ({
      id: String(ts.subjects.id),
      subjectName: ts.subjects.subject_name,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          status: teacher.status,
        },
        classes: classes.map((c) => ({
          id: c.id,
          name: c.class_name,
          stream: c.stream,
          totalStudents: c.total_students,
        })),
        subjects,
        studentCount: studentAssignments.length,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
