// =============================================================================
// Teacher repository — the ONLY place that reads/writes teacher data via Prisma.
// -----------------------------------------------------------------------------
// API routes call these functions; they never touch Prisma directly. Every
// function that lists tenant data takes an optional schoolId and filters by it.
//
// We carefully convert database types so the JSON matches the old Supabase
// route exactly: BigInt -> number, Decimal -> number, Date -> ISO string.
// =============================================================================

import { prisma } from "@/lib/db/prisma";
import { formatClassLabel } from "@/lib/teachers";

export type TeacherListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  subject_id: number | null;
  school_id: string;
  profile_photo: string | null;
  status: string;
  created_at: string | null;
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: number | null;
  class_teacher: boolean | null;
  school_name: string | null;
  subject_name: string | null;
  class_labels: string[];
};

/**
 * List teachers with their school name, subject name, and class labels.
 * Mirrors the old GET /api/teachers response. Pass schoolId to scope to one
 * school (the guard supplies this once auth is wired).
 */
export async function listTeachersWithMeta(
  opts: { schoolId?: string } = {},
): Promise<TeacherListItem[]> {
  const where = opts.schoolId ? { school_id: opts.schoolId } : {};

  const [teachers, schools, subjects, classes, timetableRows] = await Promise.all([
    prisma.teachers.findMany({
      where,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        admission_number: true,
        subject_id: true,
        school_id: true,
        profile_photo: true,
        status: true,
        created_at: true,
        days_present: true,
        total_school_days: true,
        attendance_percentage: true,
        class_teacher: true,
      },
    }),
    prisma.schools.findMany({ select: { id: true, name: true } }),
    prisma.subjects.findMany({ select: { id: true, subject_name: true } }),
    prisma.classes.findMany({
      select: { id: true, class_name: true, stream: true, class_teacher_id: true },
    }),
    prisma.teacher_timetables.findMany({
      select: { teacher_id: true, class_id: true },
    }),
  ]);

  const schoolMap = new Map(schools.map((s) => [s.id, s.name]));
  const subjectMap = new Map(subjects.map((s) => [String(s.id), s.subject_name]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const teacherClassIds = new Map<string, Set<string>>();

  for (const c of classes) {
    if (!c.class_teacher_id) continue;
    const ids = teacherClassIds.get(c.class_teacher_id) ?? new Set<string>();
    ids.add(c.id);
    teacherClassIds.set(c.class_teacher_id, ids);
  }
  for (const row of timetableRows) {
    if (!row.class_id) continue;
    const ids = teacherClassIds.get(row.teacher_id) ?? new Set<string>();
    ids.add(row.class_id);
    teacherClassIds.set(row.teacher_id, ids);
  }

  return teachers.map((t) => {
    const subjectIdNum = t.subject_id == null ? null : Number(t.subject_id);
    const classLabels = Array.from(teacherClassIds.get(t.id) ?? []).map((classId) =>
      formatClassLabel(classMap.get(classId)),
    );

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      phone: t.phone,
      admission_number: t.admission_number,
      subject_id: subjectIdNum,
      school_id: t.school_id,
      profile_photo: t.profile_photo,
      status: t.status,
      created_at: t.created_at ? t.created_at.toISOString() : null,
      days_present: t.days_present,
      total_school_days: t.total_school_days,
      attendance_percentage:
        t.attendance_percentage == null ? null : Number(t.attendance_percentage),
      class_teacher: t.class_teacher,
      school_name: schoolMap.get(t.school_id) ?? null,
      subject_name:
        subjectIdNum != null ? subjectMap.get(String(subjectIdNum)) ?? null : null,
      class_labels: classLabels,
    };
  });
}
