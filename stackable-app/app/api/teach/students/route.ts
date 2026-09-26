// =============================================================================
// GET /api/teach/students — Students assigned to the signed-in teacher
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

    // Resolve teacher via user email (no user_id FK on teachers table).
    const user = await prisma.users.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw notFound("User account has no email — cannot resolve teacher profile.");
    }

    const teacher = await prisma.teachers.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!teacher) {
      throw notFound("No teacher profile found for this account.");
    }

    const assignments = await prisma.teacher_student_assignments.findMany({
      where: { teacher_id: teacher.id },
      select: {
        student_id: true,
        students: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            admission_no: true,
            status: true,
            class_id: true,
            classes: {
              select: {
                class_name: true,
                stream: true,
              },
            },
          },
        },
      },
      distinct: ["student_id"],
      orderBy: {
        students: {
          last_name: "asc",
        },
      },
    });

    const students = assignments.map((a) => {
      const s = a.students;
      const classLabel = s.classes
        ? [s.classes.class_name, s.classes.stream].filter(Boolean).join(" ")
        : null;

      return {
        id: s.id,
        firstName: s.first_name ?? "",
        lastName: s.last_name,
        admissionNo: s.admission_no,
        status: s.status,
        classId: s.class_id,
        className: classLabel,
      };
    });

    return NextResponse.json({ ok: true, data: { students, total: students.length } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
