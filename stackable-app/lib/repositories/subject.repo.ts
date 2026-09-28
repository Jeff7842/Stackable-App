// =============================================================================
// Subject repository — the ONLY place subject data is read or written (Prisma).
// -----------------------------------------------------------------------------
// Plain PostgreSQL through Prisma; no vendor-specific features. Every function here
// is scoped to ONE school: either it takes schoolId, or it takes an `offering` that the
// caller already proved (findOffering) belongs to the session's school.
//
// Types are converted at the edge so the JSON matches what the UI reads and survives
// the JSON cache: BigInt -> number, Decimal -> number, Date -> ISO string.
//
// The maths (ranking, averages, trees) lives in lib/subjects-directory.ts and
// lib/subjects-payloads.ts; this file only loads and saves rows.
// =============================================================================

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  ClassFormOption,
  SchoolFormOption,
  SubjectAssessmentsPayload,
  SubjectCourseworkPayload,
  SubjectDetailPayload,
  SubjectDirectoryPayload,
  SubjectFormOption,
  TeacherFormOption,
} from "@/lib/subjects";
import { buildSubjectDirectory, type DirectorySubjectRow } from "@/lib/subjects-directory";
import { subjectDuplicate, subjectNotFound } from "@/lib/subjects-errors";
import {
  buildCustomSubjectCode,
  buildSubjectAssessments,
  buildSubjectCoursework,
  buildSubjectDetail,
  type OfferingRow,
} from "@/lib/subjects-payloads";

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

const toNumberOrNull = (value: unknown): number | null => (value == null ? null : Number(value));
const toIso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);

/** Prisma throws P2002 when a unique index rejects a row. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const SUBJECT_SELECT = {
  id: true,
  subject_name: true,
  subject_code: true,
  acronym: true,
  short_name: true,
  strapline: true,
  description: true,
  department: true,
  category: true,
  subject_type: true,
  education_level: true,
  requires_lab: true,
  has_coursework: true,
  has_assessments: true,
  is_elective: true,
  is_active: true,
  default_sequence: true,
  theme_token: true,
  abstract_image_url: true,
} as const;

function toSubjectRow(row: {
  id: bigint;
  subject_name: string;
  subject_code: string | null;
  acronym: string | null;
  short_name: string | null;
  strapline: string | null;
  description: string | null;
  department: string | null;
  category: string;
  subject_type: string;
  education_level: string;
  requires_lab: boolean;
  has_coursework: boolean;
  has_assessments: boolean;
  is_elective: boolean;
  is_active: boolean;
  default_sequence: number | null;
  theme_token: string | null;
  abstract_image_url: string | null;
}): DirectorySubjectRow {
  return { ...row, id: Number(row.id) };
}

// ---------------------------------------------------------------------------
// Offerings + lookups (used to prove ownership before anything else)
// ---------------------------------------------------------------------------

/**
 * One subject offering (school_subjects row) of THIS school, or null.
 * Why: every subject route starts here; an offering of another school comes back
 * as null, exactly like one that does not exist.
 */
export async function findOffering(id: string, schoolId: string): Promise<OfferingRow | null> {
  const row = await prisma.school_subjects.findFirst({
    where: { id, school_id: schoolId },
    select: { id: true, school_id: true, subject_id: true },
  });
  return row ? { id: row.id, school_id: row.school_id, subject_id: Number(row.subject_id) } : null;
}

/** A class offering that is part of this subject offering, or null. */
export async function findClassOffering(offeringId: string, classOfferingId: string) {
  return prisma.school_subject_classes.findFirst({
    where: { id: classOfferingId, school_subject_id: offeringId },
    select: { id: true, class_id: true },
  });
}

/** A curriculum topic inside this class offering, or null. */
export async function findCurriculumNode(nodeId: string, classOfferingId: string) {
  return prisma.subject_curriculum_nodes.findFirst({
    where: { id: nodeId, school_subject_class_id: classOfferingId },
    select: { id: true, depth: true },
  });
}

/** A teacher of THIS school, or null. */
export async function findTeacherInSchool(teacherId: string, schoolId: string) {
  return prisma.teachers.findFirst({ where: { id: teacherId, school_id: schoolId }, select: { id: true } });
}

/** The class offerings of this subject that match the given class ids (others are ignored). */
export async function findClassLinks(offeringId: string, classIds: string[]) {
  return prisma.school_subject_classes.findMany({
    where: { school_subject_id: offeringId, class_id: { in: classIds } },
    select: { id: true, class_id: true },
  });
}

/** True when a master subject exists. */
export async function masterSubjectExists(subjectId: number): Promise<boolean> {
  const row = await prisma.subjects.findUnique({ where: { id: subjectId }, select: { id: true } });
  return row !== null;
}

/** True when some OTHER school also offers this master subject. */
export async function isSubjectSharedWithOtherSchools(subjectId: number, schoolId: string): Promise<boolean> {
  const row = await prisma.school_subjects.findFirst({
    where: { subject_id: subjectId, school_id: { not: schoolId } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * The visibility of the resource stored at this path, but only if it belongs to THIS school.
 * @returns "private" | "public", or null when there is no such resource in the school
 */
export async function findResourceVisibilityByPath(storagePath: string, schoolId: string): Promise<string | null> {
  const row = await prisma.subject_resources.findFirst({
    where: { storage_path: storagePath, school_subject_classes: { school_subjects: { school_id: schoolId } } },
    select: { visibility: true },
  });
  return row?.visibility ?? null;
}

// ---------------------------------------------------------------------------
// Form options + directory (GET /api/subjects)
// ---------------------------------------------------------------------------

/**
 * Lists for the "Add subject" form: this school (only), its classes, its teachers, and
 * the shared master subject catalogue.
 */
export async function getSubjectFormOptions({ schoolId }: { schoolId: string }): Promise<{
  schools: SchoolFormOption[];
  classes: ClassFormOption[];
  teachers: TeacherFormOption[];
  masterSubjects: SubjectFormOption[];
}> {
  const [school, classes, teachers, subjects] = await Promise.all([
    prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
    prisma.classes.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, class_name: true, stream: true },
      orderBy: { class_name: "asc" },
    }),
    prisma.teachers.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, name: true, email: true, phone: true, profile_photo: true },
      orderBy: { name: "asc" },
    }),
    prisma.subjects.findMany({
      select: { id: true, subject_name: true, subject_code: true },
      orderBy: { subject_name: "asc" },
    }),
  ]);

  return {
    schools: school ? [{ id: school.id, name: school.name }] : [],
    classes,
    teachers,
    masterSubjects: subjects.map((row) => ({ id: Number(row.id), subject_name: row.subject_name, subject_code: row.subject_code })),
  };
}

/**
 * The subject directory for ONE school: one card per school offering plus filter/form
 * options. Every query is filtered by school_id (directly or through the school's own
 * offering / class ids). A school-level override on school_subjects (strapline,
 * description, image, theme) wins over the shared subject's.
 */
export async function getSubjectDirectory({ schoolId }: { schoolId: string }): Promise<SubjectDirectoryPayload> {
  const [options, offeringRows, subjectRows, classRows, teacherRows, teacherSubjectRows] = await Promise.all([
    getSubjectFormOptions({ schoolId }),
    prisma.school_subjects.findMany({
      where: { school_id: schoolId },
      select: {
        id: true,
        school_id: true,
        subject_id: true,
        created_at: true,
        strapline: true,
        description: true,
        abstract_image_url: true,
        theme_token: true,
      },
    }),
    prisma.subjects.findMany({ select: SUBJECT_SELECT }),
    prisma.classes.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, class_name: true, stream: true },
    }),
    prisma.teachers.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, name: true, email: true, phone: true, profile_photo: true },
    }),
    prisma.teacher_subjects.findMany({
      where: { school_id: schoolId },
      select: {
        id: true,
        teacher_id: true,
        subject_id: true,
        school_id: true,
        is_primary: true,
        school_subject_id: true,
        assignment_role: true,
      },
    }),
  ]);

  const offeringIds = offeringRows.map((row) => row.id);
  const classIds = classRows.map((row) => row.id);

  const [subjectClassRows, studentSubjectRows, gradingRows, performanceRows] = await Promise.all([
    prisma.school_subject_classes.findMany({
      where: { school_subject_id: { in: offeringIds } },
      select: { id: true, school_subject_id: true, class_id: true, display_order: true },
    }),
    prisma.student_subjects.findMany({
      where: { OR: [{ school_id: schoolId }, { school_subject_id: { in: offeringIds } }] },
      select: {
        student_id: true,
        subject_id: true,
        teacher_id: true,
        school_subject_id: true,
        school_id: true,
        is_active: true,
      },
    }),
    prisma.grading_reports.findMany({
      where: { class_id: { in: classIds } },
      select: {
        subject_id: true,
        term: true,
        class_id: true,
        created_at: true,
        school_subject_id: true,
        raw_score: true,
        normalized_pct: true,
      },
    }),
    prisma.class_subject_performance.findMany({
      where: { class_id: { in: classIds } },
      select: {
        id: true,
        class_id: true,
        subject_id: true,
        average_score: true,
        average_grade: true,
        school_subject_id: true,
      },
    }),
  ]);

  const overrideBySubject = new Map(offeringRows.map((row) => [Number(row.subject_id), row]));
  const subjects: DirectorySubjectRow[] = subjectRows.map((row) => {
    const override = overrideBySubject.get(Number(row.id));
    const base = toSubjectRow(row);
    return {
      ...base,
      strapline: override?.strapline ?? base.strapline,
      description: override?.description ?? base.description,
      theme_token: override?.theme_token ?? base.theme_token,
      abstract_image_url: override?.abstract_image_url ?? base.abstract_image_url,
    };
  });

  return buildSubjectDirectory({
    options,
    offerings: offeringRows.map((row) => ({
      id: row.id,
      school_id: row.school_id,
      subject_id: Number(row.subject_id),
      created_at: row.created_at.toISOString(),
    })),
    subjects,
    schools: options.schools,
    classes: classRows,
    schoolSubjectClasses: subjectClassRows,
    teacherSubjects: teacherSubjectRows.map((row) => ({ ...row, subject_id: Number(row.subject_id) })),
    teachers: teacherRows,
    studentSubjects: studentSubjectRows.map((row) => ({ ...row, subject_id: Number(row.subject_id) })),
    gradingReports: gradingRows.map((row) => ({
      subject_id: Number(row.subject_id),
      term: row.term,
      class_id: row.class_id,
      created_at: toIso(row.created_at),
      school_subject_id: row.school_subject_id,
      raw_score: toNumberOrNull(row.raw_score),
      normalized_pct: toNumberOrNull(row.normalized_pct),
    })),
    classPerformance: performanceRows.map((row) => ({
      id: row.id,
      class_id: row.class_id,
      subject_id: Number(row.subject_id),
      average_score: toNumberOrNull(row.average_score),
      average_grade: row.average_grade,
      school_subject_id: row.school_subject_id,
    })),
  });
}

// ---------------------------------------------------------------------------
// Detail (GET /api/subjects/[id])
// ---------------------------------------------------------------------------

/**
 * Load and build the detail payload for one offering.
 * @param offering an offering already proven to belong to the caller's school (findOffering)
 */
export async function getSubjectDetail(offering: OfferingRow): Promise<SubjectDetailPayload> {
  const { id: offeringId, school_id: schoolId, subject_id: subjectId } = offering;

  const [subject, school, classOfferings, classes, teacherSubjects, teachers, timetables, studentsBySubject, studentsByOffering] =
    await Promise.all([
      prisma.subjects.findUnique({ where: { id: subjectId }, select: SUBJECT_SELECT }),
      prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
      prisma.school_subject_classes.findMany({
        where: { school_subject_id: offeringId },
        select: { id: true, school_subject_id: true, class_id: true, display_order: true },
      }),
      prisma.classes.findMany({
        where: { school_id: schoolId },
        select: { id: true, school_id: true, class_name: true, stream: true },
      }),
      prisma.teacher_subjects.findMany({
        where: { school_id: schoolId, subject_id: subjectId },
        select: {
          id: true,
          teacher_id: true,
          subject_id: true,
          school_id: true,
          is_primary: true,
          school_subject_id: true,
          assignment_role: true,
        },
      }),
      prisma.teachers.findMany({
        where: { school_id: schoolId },
        select: { id: true, school_id: true, name: true, email: true, phone: true, profile_photo: true },
      }),
      prisma.teacher_timetables.findMany({
        where: { school_id: schoolId, subject_id: subjectId },
        select: { teacher_id: true, class_id: true, subject_id: true },
      }),
      prisma.student_subjects.findMany({
        where: { subject_id: subjectId, school_id: schoolId },
        select: {
          student_id: true,
          subject_id: true,
          teacher_id: true,
          school_subject_id: true,
          school_id: true,
          is_active: true,
        },
      }),
      prisma.student_subjects.findMany({
        where: { subject_id: subjectId, school_subject_id: offeringId },
        select: {
          student_id: true,
          subject_id: true,
          teacher_id: true,
          school_subject_id: true,
          school_id: true,
          is_active: true,
        },
      }),
    ]);

  // The student+subject pair is unique in the database: it is the de-duplication key.
  const links = new Map<string, (typeof studentsBySubject)[number]>();
  for (const row of [...studentsBySubject, ...studentsByOffering]) links.set(`${row.student_id}:${row.subject_id}`, row);
  const studentSubjects = Array.from(links.values());

  const classIds = classes.map((row) => row.id);
  const [students, gradingReports, performance] = await Promise.all([
    prisma.students.findMany({
      where: { school_id: schoolId, id: { in: studentSubjects.map((row) => row.student_id) } },
      select: {
        id: true,
        school_id: true,
        admission_no: true,
        class_id: true,
        first_name: true,
        last_name: true,
        profile_picture: true,
        status: true,
      },
    }),
    // The whole school's grades (all subjects) so the school rank compares subjects fairly.
    prisma.grading_reports.findMany({
      where: { class_id: { in: classIds } },
      select: {
        id: true,
        student_id: true,
        subject_id: true,
        term: true,
        class_id: true,
        grade: true,
        teacher_id: true,
        created_at: true,
        school_subject_id: true,
        raw_score: true,
        normalized_pct: true,
      },
    }),
    prisma.class_subject_performance.findMany({
      where: { subject_id: subjectId, class_id: { in: classIds } },
      select: {
        id: true,
        class_id: true,
        subject_id: true,
        average_score: true,
        average_grade: true,
        school_subject_id: true,
      },
    }),
  ]);

  return buildSubjectDetail({
    offering,
    subject: subject ? toSubjectRow(subject) : null,
    school,
    schoolSubjectClasses: classOfferings,
    classes,
    teacherSubjects: teacherSubjects.map((row) => ({ ...row, subject_id: Number(row.subject_id) })),
    teachers,
    teacherTimetables: timetables.map((row) => ({ ...row, subject_id: toNumberOrNull(row.subject_id) })),
    studentSubjects: studentSubjects.map((row) => ({ ...row, subject_id: Number(row.subject_id) })),
    students,
    schoolGradingReports: gradingReports.map((row) => ({
      ...row,
      subject_id: Number(row.subject_id),
      created_at: toIso(row.created_at),
      raw_score: toNumberOrNull(row.raw_score),
      normalized_pct: toNumberOrNull(row.normalized_pct),
    })),
    classPerformance: performance.map((row) => ({
      ...row,
      subject_id: Number(row.subject_id),
      average_score: toNumberOrNull(row.average_score),
    })),
  });
}

// ---------------------------------------------------------------------------
// Assessments (GET /api/subjects/[id]/assessments)
// ---------------------------------------------------------------------------

/** Upcoming and past assessments for one offering (already proven to be this school's). */
export async function getSubjectAssessments(offering: OfferingRow): Promise<SubjectAssessmentsPayload> {
  const { id: offeringId, school_id: schoolId } = offering;

  const [assessments, classOfferings, classes, teachers] = await Promise.all([
    prisma.assessments.findMany({
      where: { school_subject_id: offeringId, school_id: schoolId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        term: true,
        duration_minutes: true,
        scheduled_start_at: true,
        scheduled_end_at: true,
        status: true,
      },
    }),
    prisma.school_subject_classes.findMany({
      where: { school_subject_id: offeringId },
      select: { id: true, school_subject_id: true, class_id: true, display_order: true },
    }),
    prisma.classes.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, class_name: true, stream: true },
    }),
    prisma.teachers.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, name: true, email: true, phone: true, profile_photo: true },
    }),
  ]);

  // Targets and results are read only for THIS offering's assessments, never table-wide.
  const targets = await prisma.assessment_targets.findMany({
    where: { assessment_id: { in: assessments.map((row) => row.id) } },
    select: {
      id: true,
      assessment_id: true,
      school_subject_class_id: true,
      class_id: true,
      teacher_id: true,
      status: true,
      started_at: true,
      completed_at: true,
      linger_until: true,
    },
  });
  const results = await prisma.assessment_results.findMany({
    where: { assessment_target_id: { in: targets.map((row) => row.id) } },
    select: { assessment_target_id: true, raw_score: true, normalized_pct: true, grade: true, published_at: true },
  });

  return buildSubjectAssessments({
    schoolSubjectId: offeringId,
    assessments: assessments.map((row) => ({
      ...row,
      scheduled_start_at: toIso(row.scheduled_start_at),
      scheduled_end_at: toIso(row.scheduled_end_at),
    })),
    targets: targets.map((row) => ({
      ...row,
      started_at: toIso(row.started_at),
      completed_at: toIso(row.completed_at),
      linger_until: toIso(row.linger_until),
    })),
    results: results.map((row) => ({
      ...row,
      raw_score: toNumberOrNull(row.raw_score),
      normalized_pct: toNumberOrNull(row.normalized_pct),
      published_at: toIso(row.published_at),
    })),
    schoolSubjectClasses: classOfferings,
    classes,
    teachers,
  });
}

// ---------------------------------------------------------------------------
// Coursework (GET /api/subjects/[id]/coursework)
// ---------------------------------------------------------------------------

/**
 * Class offerings, progress, curriculum trees and resources for one offering.
 * @param offering            an offering already proven to be this school's
 * @param classOfferingId     optional: only that class offering's tree + resources are loaded
 * @returns the payload, or null when the requested class offering is not part of this subject
 */
export async function getSubjectCoursework(
  offering: OfferingRow,
  classOfferingId?: string | null,
): Promise<SubjectCourseworkPayload | null> {
  const { id: offeringId, school_id: schoolId, subject_id: subjectId } = offering;

  const [subject, school, classOfferings, classes] = await Promise.all([
    prisma.subjects.findUnique({
      where: { id: subjectId },
      select: { subject_name: true, strapline: true, description: true, abstract_image_url: true },
    }),
    prisma.schools.findUnique({ where: { id: schoolId }, select: { id: true, name: true } }),
    prisma.school_subject_classes.findMany({
      where: { school_subject_id: offeringId },
      select: { id: true, school_subject_id: true, class_id: true, display_order: true },
    }),
    prisma.classes.findMany({
      where: { school_id: schoolId },
      select: { id: true, school_id: true, class_name: true, stream: true },
    }),
  ]);

  if (!subject || !school) throw new Error("Coursework payload could not be loaded.");

  const allIds = classOfferings.map((row) => row.id);
  if (classOfferingId && !allIds.includes(classOfferingId)) return null;
  // Tree + resources are read only for the class offerings we will actually return.
  const detailIds = classOfferingId ? [classOfferingId] : allIds;

  const [classProgress, nodes, nodeProgress, resources] = await Promise.all([
    prisma.subject_class_progress.findMany({
      where: { school_subject_class_id: { in: allIds } },
      select: { school_subject_class_id: true, current_node_id: true, syllabus_progress_pct: true },
    }),
    prisma.subject_curriculum_nodes.findMany({
      where: { school_subject_class_id: { in: detailIds } },
      select: {
        id: true,
        school_subject_class_id: true,
        parent_id: true,
        title: true,
        node_type: true,
        sort_order: true,
        depth: true,
      },
    }),
    prisma.subject_curriculum_progress.findMany({
      where: { school_subject_class_id: { in: detailIds } },
      select: { school_subject_class_id: true, curriculum_node_id: true, completion_state: true, completed_at: true },
    }),
    prisma.subject_resources.findMany({
      where: { school_subject_class_id: { in: detailIds } },
      select: {
        id: true,
        school_subject_class_id: true,
        curriculum_node_id: true,
        resource_type: true,
        title: true,
        short_description: true,
        author_name: true,
        cover_image_url: true,
        storage_path: true,
        source_url: true,
        visibility: true,
        uploaded_by: true,
        uploaded_at: true,
      },
    }),
  ]);

  return buildSubjectCoursework({
    schoolSubjectId: offeringId,
    subject,
    school,
    schoolSubjectClasses: classOfferings,
    classes,
    classProgress: classProgress.map((row) => ({ ...row, syllabus_progress_pct: toNumberOrNull(row.syllabus_progress_pct) })),
    nodes,
    nodeProgress: nodeProgress.map((row) => ({ ...row, completed_at: toIso(row.completed_at) })),
    resources: resources.map((row) => ({ ...row, uploaded_at: toIso(row.uploaded_at) })),
    classOfferingId,
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type NewSubjectData = {
  subject_name: string;
  subject_code: string | null;
  acronym: string | null;
  short_name: string | null;
  strapline: string | null;
  description: string | null;
  department: string | null;
  category: string;
  subject_type: string;
  education_level: string;
  requires_lab: boolean;
  has_coursework: boolean;
  has_assessments: boolean;
  is_elective: boolean;
  is_active: boolean;
  default_sequence: number | null;
  theme_token: string | null;
};

export type CreateOfferingArgs = {
  schoolId: string;
  /** Link this master subject… */
  existingSubjectId: number | null;
  /** …or create this one. */
  newSubject: NewSubjectData | null;
  /** Public URL of the uploaded/chosen background, or null. */
  backgroundImageUrl: string | null;
  classIds: string[];
  teacherAssignments: Array<{ teacher_id: string; assignment_role: string; is_primary: boolean }>;
};

const MAX_OFFERING_ATTEMPTS = 5; // retries when two creates race for the same code / sequence number

/**
 * Create (or link) a master subject, this school's offering of it, the class links and
 * the teacher assignments, all in ONE database transaction.
 *
 * `school_subject_seq` (next number for the school) and `custom_subject_code` are filled
 * here: the old Supabase project used a trigger, plain PostgreSQL does not have one. Two
 * simultaneous creates can pick the same values; the unique indexes reject the loser,
 * which then retries with fresh values.
 *
 * @throws ApiError 404 when the existing master subject is gone, 409 when a NEW subject's
 *         name/code already exists
 */
export async function createSubjectOffering(args: CreateOfferingArgs): Promise<{ id: string; subject_id: number }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => createOfferingInTransaction(tx, args));
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_OFFERING_ATTEMPTS) continue;
      throw error;
    }
  }
}

async function createOfferingInTransaction(tx: Prisma.TransactionClient, args: CreateOfferingArgs) {
  const { schoolId } = args;
  let subjectId = args.existingSubjectId;
  let codeLabel = "";

  if (subjectId) {
    const existing = await tx.subjects.findUnique({
      where: { id: subjectId },
      select: { subject_name: true, subject_code: true },
    });
    if (!existing) throw subjectNotFound("Subject not found.");
    codeLabel = existing.subject_name;
    if (args.backgroundImageUrl != null) {
      await tx.subjects.update({
        where: { id: subjectId },
        data: { abstract_image_url: args.backgroundImageUrl, updated_at: new Date() },
      });
    }
  } else if (args.newSubject) {
    try {
      const created = await tx.subjects.create({
        data: { ...args.newSubject, abstract_image_url: args.backgroundImageUrl },
        select: { id: true },
      });
      subjectId = Number(created.id);
      codeLabel = args.newSubject.subject_name;
    } catch (error) {
      // A repeated name/code is the caller's mistake, not a race: report it, don't retry.
      if (isUniqueViolation(error)) throw subjectDuplicate();
      throw error;
    }
  }
  if (!subjectId) throw new Error("createSubjectOffering needs an existing subject or new subject data.");

  let offering = await tx.school_subjects.findFirst({
    where: { school_id: schoolId, subject_id: subjectId },
    select: { id: true },
  });
  if (!offering) {
    const last = await tx.school_subjects.aggregate({
      where: { school_id: schoolId },
      _max: { school_subject_seq: true },
    });
    offering = await tx.school_subjects.create({
      data: {
        school_id: schoolId,
        subject_id: subjectId,
        school_subject_seq: (last._max.school_subject_seq ?? 0) + 1,
        custom_subject_code: buildCustomSubjectCode(codeLabel, () => randomInt(0, 10000)),
      },
      select: { id: true },
    });
  }

  if (args.classIds.length > 0) {
    // Only classes of THIS school; other schools' ids are silently ignored.
    const classes = await tx.classes.findMany({
      where: { school_id: schoolId, id: { in: args.classIds } },
      select: { id: true },
    });
    const valid = new Set(classes.map((row) => row.id));
    const ordered = args.classIds.filter((id) => valid.has(id));
    for (const [index, classId] of ordered.entries()) {
      await tx.school_subject_classes.upsert({
        where: { school_subject_id_class_id: { school_subject_id: offering.id, class_id: classId } },
        create: { school_subject_id: offering.id, class_id: classId, display_order: index },
        update: { display_order: index, updated_at: new Date() },
      });
    }
  }

  if (args.teacherAssignments.length > 0) {
    // Only teachers of THIS school; other schools' ids are silently ignored.
    const teachers = await tx.teachers.findMany({
      where: { school_id: schoolId, id: { in: args.teacherAssignments.map((item) => item.teacher_id) } },
      select: { id: true },
    });
    const valid = new Set(teachers.map((row) => row.id));
    for (const item of args.teacherAssignments.filter((row) => valid.has(row.teacher_id))) {
      await tx.teacher_subjects.upsert({
        where: {
          teacher_id_subject_id_school_id: { teacher_id: item.teacher_id, subject_id: subjectId, school_id: schoolId },
        },
        create: {
          teacher_id: item.teacher_id,
          subject_id: subjectId,
          school_id: schoolId,
          school_subject_id: offering.id,
          assignment_role: item.assignment_role,
          is_primary: item.is_primary,
        },
        update: {
          school_subject_id: offering.id,
          assignment_role: item.assignment_role,
          is_primary: item.is_primary,
          updated_at: new Date(),
        },
      });
    }
  }

  return { id: offering.id, subject_id: subjectId };
}

export type NewAssessmentData = {
  type: string;
  title: string;
  description: string | null;
  term: string | null;
  total_marks_raw: number | null;
  duration_minutes: number | null;
  scheduled_start_at: Date | null;
  scheduled_end_at: Date | null;
  created_by: string | null;
  teacher_id: string | null;
};

/** Create an assessment and one target per class offering in a single transaction (nested write). */
export async function createAssessmentWithTargets(
  offering: { id: string; school_id: string },
  data: NewAssessmentData,
  links: Array<{ id: string; class_id: string }>,
): Promise<void> {
  await prisma.assessments.create({
    data: {
      school_id: offering.school_id,
      school_subject_id: offering.id,
      type: data.type,
      title: data.title,
      description: data.description,
      term: data.term,
      total_marks_raw: data.total_marks_raw,
      duration_minutes: data.duration_minutes,
      scheduled_start_at: data.scheduled_start_at,
      scheduled_end_at: data.scheduled_end_at,
      status: "scheduled",
      created_by: data.created_by,
      assessment_targets: {
        create: links.map((link) => ({
          school_subject_class_id: link.id,
          class_id: link.class_id,
          teacher_id: data.teacher_id,
          status: "scheduled",
        })),
      },
    },
    select: { id: true },
  });
}

/** Add a topic to a class offering's curriculum tree. */
export async function insertCurriculumNode(data: {
  school_subject_class_id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
}): Promise<void> {
  await prisma.subject_curriculum_nodes.create({ data, select: { id: true } });
}

/** Add a resource row (the file, if any, is already in storage). */
export async function insertResource(data: {
  school_subject_class_id: string;
  curriculum_node_id: string | null;
  resource_type: string;
  title: string;
  short_description: string | null;
  author_name: string | null;
  cover_image_url: string | null;
  storage_path: string | null;
  source_url: string | null;
  visibility: string;
  uploaded_by: string | null;
}): Promise<void> {
  await prisma.subject_resources.create({ data: { ...data, uploaded_at: new Date() }, select: { id: true } });
}

/** A resource inside this subject offering, or null. */
export async function findResourceInOffering(offeringId: string, resourceId: string) {
  return prisma.subject_resources.findFirst({
    where: { id: resourceId, school_subject_classes: { school_subject_id: offeringId } },
    select: { id: true, visibility: true },
  });
}

/** Switch a resource's visibility and record the change in the history table, atomically. */
export async function updateResourceVisibility(
  resourceId: string,
  previous: string,
  next: string,
  changedBy: string | null,
): Promise<void> {
  await prisma.$transaction([
    prisma.subject_resources.update({ where: { id: resourceId }, data: { visibility: next, updated_at: new Date() } }),
    prisma.subject_resource_visibility_events.create({
      data: { resource_id: resourceId, previous_visibility: previous, next_visibility: next, changed_by: changedBy },
    }),
  ]);
}

/** Save a class offering's current topic and syllabus percentage (one row per class offering). */
export async function upsertClassProgress(
  classOfferingId: string,
  currentNodeId: string | null,
  pct: number | null,
): Promise<void> {
  await prisma.subject_class_progress.upsert({
    where: { school_subject_class_id: classOfferingId },
    create: { school_subject_class_id: classOfferingId, current_node_id: currentNodeId, syllabus_progress_pct: pct },
    update: { current_node_id: currentNodeId, syllabus_progress_pct: pct, updated_at: new Date() },
  });
}
