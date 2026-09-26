// =============================================================================
// Parent repository — data a parent is allowed to see about THEIR children.
// -----------------------------------------------------------------------------
// Security: every function starts from the logged-in parent's userId, finds the
// parent's own children via student_parents, and NEVER lets a parent read a
// child that isn't linked to them. (student_parents has no DB foreign key to
// students, so we fetch students by id ourselves.)
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { forbidden, notFound } from "@/lib/api/errors";

export type ChildCard = {
  studentId: string;
  firstName: string | null;
  lastName: string;
  admissionNo: string;
  className: string | null;
  profilePicture: string | null;
  averageGrade: string | null;
  relationship: string;
  isPrimary: boolean;
};

export type ChildOverview = {
  student: {
    id: string;
    firstName: string | null;
    lastName: string;
    admissionNo: string;
    className: string | null;
    profilePicture: string | null;
    status: string;
  };
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
    rate: number; // percentage present (+late) out of total
  };
};

function classLabel(c: { class_name: string; stream: string | null } | null): string | null {
  if (!c) return null;
  return c.stream ? `${c.class_name} ${c.stream}` : c.class_name;
}

/** Find the parent row for a logged-in user. Throws if they aren't a parent. */
async function getParentByUser(userId: string) {
  const parent = await prisma.parent.findUnique({ where: { user_id: userId } });
  if (!parent) throw notFound("No parent profile found for this account.");
  return parent;
}

/** Cards for each child linked to this parent. */
export async function getParentChildren(userId: string): Promise<ChildCard[]> {
  const parent = await getParentByUser(userId);

  const links = await prisma.student_parents.findMany({
    where: { parent_id: parent.id },
    select: { student_id: true, relationship: true, is_primary: true },
  });
  if (links.length === 0) return [];

  const students = await prisma.students.findMany({
    where: { id: { in: links.map((l) => l.student_id) } },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      profile_picture: true,
      average_grade: true,
      classes: { select: { class_name: true, stream: true } },
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  return links
    .map((link) => {
      const s = studentMap.get(link.student_id);
      if (!s) return null;
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
      };
    })
    .filter((x): x is ChildCard => x !== null);
}

/** Full overview of ONE child — only if that child is linked to this parent. */
export async function getChildOverview(
  userId: string,
  studentId: string,
): Promise<ChildOverview> {
  const parent = await getParentByUser(userId);

  const link = await prisma.student_parents.findFirst({
    where: { parent_id: parent.id, student_id: studentId },
    select: { id: true },
  });
  if (!link) throw forbidden("This child is not linked to your account.");

  const student = await prisma.students.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      user_id: true,
      first_name: true,
      last_name: true,
      admission_no: true,
      profile_picture: true,
      status: true,
      classes: { select: { class_name: true, stream: true } },
    },
  });
  if (!student) throw notFound("Student not found.");

  const [reports, attendanceRows] = await Promise.all([
    prisma.grading_reports.findMany({
      where: { student_id: studentId },
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
      profilePicture: student.profile_picture,
      status: student.status,
    },
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
