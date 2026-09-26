// =============================================================================
// Subject repository — the ONLY place that reads subject data via Prisma.
// -----------------------------------------------------------------------------
// API routes call these functions; they never touch Prisma directly. All data
// is scoped to one school via school_id.
//
// Type conversions applied to match JSON output:
//   BigInt -> number, Decimal -> number, Date -> ISO string.
// =============================================================================

import { prisma } from "@/lib/db/prisma";

export type SubjectListItem = {
  id: string;
  school_id: string;
  subject_id: number;
  subject_name: string;
  category: string;
  subject_type: string;
  education_level: string;
  is_active: boolean;
  abstract_image_url: string | null;
  description: string | null;
  strapline: string | null;
  acronym: string | null;
  class_count: number;
  teacher_count: number;
};

/**
 * List school_subjects for one school with their subject metadata, class count,
 * and teacher assignment count. Mirrors the shape the GET /api/subjects handler
 * returns. Pass schoolId to scope to one school (supplied by the auth guard).
 */
export async function listSubjectsWithMeta({
  schoolId,
}: {
  schoolId: string;
}): Promise<SubjectListItem[]> {
  const schoolSubjects = await prisma.school_subjects.findMany({
    where: { school_id: schoolId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      school_id: true,
      subject_id: true,
      abstract_image_url: true,
      description: true,
      strapline: true,
      subjects: {
        select: {
          subject_name: true,
          category: true,
          subject_type: true,
          education_level: true,
          is_active: true,
          acronym: true,
        },
      },
      school_subject_classes: {
        select: { id: true },
      },
      school_subject_teacher_assignments: {
        select: { id: true },
      },
    },
  });

  return schoolSubjects.map((ss) => ({
    id: ss.id,
    school_id: ss.school_id,
    subject_id: Number(ss.subject_id),
    subject_name: ss.subjects.subject_name,
    category: ss.subjects.category,
    subject_type: ss.subjects.subject_type,
    education_level: ss.subjects.education_level,
    is_active: ss.subjects.is_active,
    // Prefer the school-level override; fall back to the global subject value.
    abstract_image_url: ss.abstract_image_url ?? null,
    description: ss.description ?? null,
    strapline: ss.strapline ?? null,
    acronym: ss.subjects.acronym ?? null,
    class_count: ss.school_subject_classes.length,
    teacher_count: ss.school_subject_teacher_assignments.length,
  }));
}
