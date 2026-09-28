// =============================================================================
// Student repository — data a student is allowed to see about THEMSELVES.
// -----------------------------------------------------------------------------
// Security: every function starts from the logged-in student's userId, finds
// the student's own row, and only ever returns data scoped to that student.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import type { StudentDashboardData } from "./portal-types";
import { loadStudentDashboard, loadStudentGrades } from "./student-portal.repo";

// Contract type (see portal-types.ts); re-exported so existing imports keep working.
export type { StudentDashboardData } from "./portal-types";

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

/**
 * Full dashboard data for the logged-in student (StudentDashboardData).
 * The implementation lives in student-portal.repo.ts.
 */
export async function getStudentDashboard(userId: string): Promise<StudentDashboardData> {
  return loadStudentDashboard(userId);
}

/**
 * Just the grades list for the logged-in student — used by the grades page.
 * The implementation lives in student-portal.repo.ts.
 */
export async function getStudentGrades(
  userId: string,
): Promise<StudentDashboardData["grades"]> {
  return loadStudentGrades(userId);
}
