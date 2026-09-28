// =============================================================================
// Subject payload builders — pure, database-free.
// -----------------------------------------------------------------------------
// lib/repositories/subject.repo.ts loads plain rows for ONE school (Prisma) and
// hands them to the functions below, which produce the exact JSON the subjects
// pages read (SubjectDetailPayload, SubjectAssessmentsPayload,
// SubjectCourseworkPayload). Keeping the maths here, away from the database,
// means it can be unit-tested with fake rows (lib/validation/subjects.check.ts).
//
// Rows use database column names (snake_case) with numbers/strings only:
// BigInt -> number, Decimal -> number, Date -> ISO string. The result therefore
// round-trips through the JSON cache unchanged.
// =============================================================================

import {
  average,
  formatClassLabel,
  getRolePriority,
  scoreToGrade,
  toScore,
  truncateWords,
  type AssessmentTimelineItem,
  type CourseworkOutlineNode,
  type SubjectAssessmentsPayload,
  type SubjectCourseworkPayload,
  type SubjectDetailPayload,
  type SubjectPerformancePoint,
  type SubjectResourceCard,
  type SubjectStudentRow,
  type SubjectTeacherRow,
} from "@/lib/subjects";
import {
  getLatestTerm,
  getSubjectScore,
  matchesOfferingByBridge,
  type DirectoryClassRow,
  type DirectoryPerformanceRow,
  type DirectoryStudentSubjectRow,
  type DirectorySubjectClassRow,
  type DirectorySubjectRow,
  type DirectoryTeacherRow,
  type DirectoryTeacherSubjectRow,
} from "@/lib/subjects-directory";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type OfferingRow = { id: string; school_id: string; subject_id: number };

export type DetailStudentRow = {
  id: string;
  school_id: string;
  admission_no: string;
  class_id: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
  status: string;
};

export type DetailGradingRow = {
  id: string;
  student_id: string;
  subject_id: number;
  term: string;
  class_id: string;
  grade: string;
  teacher_id: string;
  created_at: string | null;
  school_subject_id: string | null;
  raw_score: number | string | null;
  normalized_pct: number | string | null;
};

export type TimetableRow = { teacher_id: string; class_id: string | null; subject_id: number | null };

export type AssessmentRowData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  term: string | null;
  duration_minutes: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
};

export type AssessmentTargetRowData = {
  id: string;
  assessment_id: string;
  school_subject_class_id: string | null;
  class_id: string;
  teacher_id: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  linger_until: string | null;
};

export type AssessmentResultRowData = {
  assessment_target_id: string;
  raw_score: number | string | null;
  normalized_pct: number | string | null;
  grade: string | null;
  published_at: string | null;
};

export type ClassProgressRowData = {
  school_subject_class_id: string;
  current_node_id: string | null;
  syllabus_progress_pct: number | string | null;
};

export type CurriculumNodeRowData = {
  id: string;
  school_subject_class_id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
};

export type CurriculumProgressRowData = {
  school_subject_class_id: string;
  curriculum_node_id: string;
  completion_state: string;
  completed_at: string | null;
};

export type ResourceRowData = {
  id: string;
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
  uploaded_at: string | null;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Same-origin URL that streams/downloads an uploaded resource (`/api/subjects/resource?path=...`).
 * Null when the resource is link-only.
 */
export function createSignedResourceUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  return `/api/subjects/resource?path=${encodeURIComponent(storagePath)}`;
}

function getStudentName(student: DetailStudentRow) {
  const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
  return fullName || "Unnamed student";
}

function buildTrendPoints(reports: DetailGradingRow[]): SubjectPerformancePoint[] {
  const grouped = new Map<
    string,
    { scores: number[]; recentScores: number[]; latestCreatedAt: string | null }
  >();

  const sorted = [...reports].sort((left, right) =>
    String(left.created_at ?? "").localeCompare(String(right.created_at ?? "")),
  );

  for (const row of sorted) {
    const key = row.term || "Untitled term";
    const score = getSubjectScore(row);
    if (score == null) continue;
    const entry = grouped.get(key) ?? {
      scores: [],
      recentScores: [],
      latestCreatedAt: row.created_at,
    };
    entry.scores.push(score);
    entry.recentScores = [...entry.recentScores.slice(-4), score];
    entry.latestCreatedAt = row.created_at;
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries())
    .map(([label, entry]) => ({
      label,
      averageScore: average(entry.scores),
      recentAverage: average(entry.recentScores),
      latestCreatedAt: entry.latestCreatedAt,
    }))
    .sort((left, right) =>
      String(left.latestCreatedAt ?? "").localeCompare(String(right.latestCreatedAt ?? "")),
    )
    .map(({ latestCreatedAt: _latestCreatedAt, ...point }) => point);
}

function buildCurriculumTree(
  nodes: CurriculumNodeRowData[],
  progressRows: CurriculumProgressRowData[],
) {
  const progressMap = new Map(
    progressRows.map((row) => [
      row.curriculum_node_id,
      {
        completionState: row.completion_state as CourseworkOutlineNode["completionState"],
        completedAt: row.completed_at,
      },
    ]),
  );

  const baseMap = new Map<string, CourseworkOutlineNode>();
  const roots: CourseworkOutlineNode[] = [];

  for (const node of [...nodes].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.title.localeCompare(right.title);
  })) {
    const progress = progressMap.get(node.id);
    baseMap.set(node.id, {
      id: node.id,
      parentId: node.parent_id,
      title: node.title,
      nodeType: node.node_type,
      sortOrder: node.sort_order,
      depth: node.depth,
      completionState: progress?.completionState ?? "pending",
      completedAt: progress?.completedAt ?? null,
      children: [],
    });
  }

  for (const node of baseMap.values()) {
    if (node.parentId && baseMap.has(node.parentId)) {
      baseMap.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type DetailInput = {
  offering: OfferingRow;
  subject: DirectorySubjectRow | null;
  school: { id: string; name: string } | null;
  schoolSubjectClasses: DirectorySubjectClassRow[];
  classes: DirectoryClassRow[];
  teacherSubjects: DirectoryTeacherSubjectRow[];
  teachers: DirectoryTeacherRow[];
  teacherTimetables: TimetableRow[];
  /** Enrolment links for this subject in this school (not yet narrowed to the offering). */
  studentSubjects: DirectoryStudentSubjectRow[];
  students: DetailStudentRow[];
  /** Every grade row of the school's classes (all subjects), so the school rank compares subjects fairly. */
  schoolGradingReports: DetailGradingRow[];
  classPerformance: DirectoryPerformanceRow[];
};

/**
 * Everything the subject detail page shows for one offering: hero facts, head of
 * department, KPIs, class grid, teachers, students and the performance trend.
 * @throws Error when the subject or school row is missing (data integrity problem)
 */
export function buildSubjectDetail(input: DetailInput): SubjectDetailPayload {
  const { offering, subject, school, schoolSubjectClasses, classes, teachers, teacherTimetables, students } = input;
  const schoolSubjectId = offering.id;

  if (!subject || !school) {
    throw new Error("Subject detail could not be loaded.");
  }

  const teacherSubjects = input.teacherSubjects.filter((row) => matchesOfferingByBridge(offering, row));
  const studentSubjects = input.studentSubjects.filter((row) => matchesOfferingByBridge(offering, row));
  const timetables = teacherTimetables.filter((row) => Number(row.subject_id) === offering.subject_id);
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const studentMap = new Map(
    students
      .filter((student) => student.school_id === offering.school_id)
      .map((student) => [student.id, student] as const),
  );
  const offeredClassIds = new Set(schoolSubjectClasses.map((row) => row.class_id));

  const gradingReports = input.schoolGradingReports.filter((row) => row.subject_id === offering.subject_id);
  const scopedReports = gradingReports.filter((row) => {
    const classItem = classMap.get(row.class_id);
    return (
      classItem?.school_id === offering.school_id &&
      row.subject_id === offering.subject_id &&
      offeredClassIds.has(row.class_id)
    );
  });

  const latestTerm = getLatestTerm(scopedReports);
  const latestTermReports = latestTerm
    ? scopedReports.filter((row) => row.term === latestTerm)
    : scopedReports;

  const allSchoolReports = input.schoolGradingReports.filter((row) => {
    const classItem = classMap.get(row.class_id);
    return classItem?.school_id === offering.school_id;
  });
  const schoolLatestTerm = getLatestTerm(allSchoolReports);
  const schoolLatestReports = schoolLatestTerm
    ? allSchoolReports.filter((row) => row.term === schoolLatestTerm)
    : allSchoolReports;

  const rankingAggregate = new Map<number, number[]>();
  for (const row of schoolLatestReports) {
    const score = getSubjectScore(row);
    if (score == null) continue;
    const bucket = rankingAggregate.get(row.subject_id) ?? [];
    bucket.push(score);
    rankingAggregate.set(row.subject_id, bucket);
  }

  const schoolRankList = Array.from(rankingAggregate.entries())
    .map(([subjectId, scores]) => ({
      subjectId,
      averageScore: average(scores) ?? 0,
    }))
    .sort((left, right) => right.averageScore - left.averageScore);

  const schoolRank =
    schoolRankList.findIndex((item) => item.subjectId === offering.subject_id) + 1 || null;

  const teacherEntries = teacherSubjects
    .sort((left, right) => {
      const roleGap =
        getRolePriority(left.assignment_role) -
        getRolePriority(right.assignment_role);
      if (roleGap !== 0) return roleGap;
      return Number(right.is_primary) - Number(left.is_primary);
    })
    .flatMap((row) => {
      const teacher = teacherMap.get(row.teacher_id);
      if (!teacher) return [];

      const classLabels = Array.from(
        new Set(
          timetables
            .filter((item) => item.teacher_id === row.teacher_id && item.class_id)
            .map((item) =>
              formatClassLabel(item.class_id ? classMap.get(item.class_id) : null),
            ),
        ),
      );

      const learnerAverage = average(
        latestTermReports
          .filter((report) => report.teacher_id === row.teacher_id)
          .map((report) => getSubjectScore(report)),
      );

      return [
        [
          row.teacher_id,
          {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
            profilePhoto: teacher.profile_photo,
            role: row.assignment_role,
            isPrimary: row.is_primary,
            classes: classLabels,
            learnerAverage,
          } satisfies SubjectTeacherRow,
        ] as const,
      ];
    });

  const teacherRows: SubjectTeacherRow[] = Array.from(new Map(teacherEntries).values());

  const headOfDepartment =
    teacherRows.find((row) => row.role.toLowerCase() === "hod") ??
    teacherRows.find((row) => row.role.toLowerCase() === "lead") ??
    teacherRows.find((row) => row.isPrimary) ??
    teacherRows[0] ??
    null;

  const studentRows: SubjectStudentRow[] = studentSubjects
    .map((link) => {
      const student = studentMap.get(link.student_id);
      if (!student) return null;
      const reports = scopedReports.filter((report) => report.student_id === student.id);
      const avgScore = average(reports.map((report) => getSubjectScore(report)));
      const reportTeacher = teacherMap.get(link.teacher_id ?? "")?.name;
      const fallbackTeacher = teacherMap.get(reports[0]?.teacher_id ?? "")?.name ?? null;

      return {
        id: student.id,
        fullName: getStudentName(student),
        admissionNo: student.admission_no,
        classLabel: formatClassLabel(student.class_id ? classMap.get(student.class_id) : null),
        avgScore,
        grade: reports[0]?.grade ?? scoreToGrade(avgScore),
        teacherName: reportTeacher ?? fallbackTeacher,
        profilePhoto: student.profile_picture,
        status: student.status,
      } satisfies SubjectStudentRow;
    })
    .filter((row): row is SubjectStudentRow => Boolean(row))
    .sort((left, right) => {
      const scoreGap = (right.avgScore ?? -1) - (left.avgScore ?? -1);
      if (scoreGap !== 0) return scoreGap;
      return left.fullName.localeCompare(right.fullName);
    });

  const performanceRows = input.classPerformance.filter((row) => {
    if (row.school_subject_id) return row.school_subject_id === schoolSubjectId;
    return offeredClassIds.has(row.class_id);
  });

  const classPerformanceRows =
    performanceRows.length > 0
      ? performanceRows.map((row) => ({
          id: row.id,
          classId: row.class_id,
          classLabel: formatClassLabel(classMap.get(row.class_id)),
          averageScore: toScore(row.average_score),
          averageGrade: row.average_grade,
        }))
      : Array.from(offeredClassIds).map((classId) => {
          const reports = scopedReports.filter((row) => row.class_id === classId);
          const avgScore = average(reports.map((report) => getSubjectScore(report)));
          return {
            id: `derived-${classId}`,
            classId,
            classLabel: formatClassLabel(classMap.get(classId)),
            averageScore: avgScore,
            averageGrade: reports[0]?.grade ?? scoreToGrade(avgScore),
          };
        });

  const averageScore = average(latestTermReports.map((row) => getSubjectScore(row)));
  const teacherStudentRatio =
    teacherRows.length > 0 && studentRows.length > 0
      ? Math.round((studentRows.length / teacherRows.length) * 100) / 100
      : null;

  return {
    id: schoolSubjectId,
    schoolId: school.id,
    schoolName: school.name,
    subjectId: subject.id,
    title: subject.subject_name,
    subjectCode: subject.subject_code,
    acronym: subject.acronym,
    shortName: subject.short_name,
    strapline:
      truncateWords(subject.strapline, 5) ??
      truncateWords(subject.description, 5) ??
      "Structured academic growth hub",
    description: subject.description,
    department: subject.department,
    category: subject.category,
    subjectType: subject.subject_type,
    educationLevel: subject.education_level,
    requiresLab: subject.requires_lab,
    hasCoursework: subject.has_coursework,
    hasAssessments: subject.has_assessments,
    isElective: subject.is_elective,
    isActive: subject.is_active,
    themeToken: subject.theme_token,
    abstractImageUrl: subject.abstract_image_url,
    headOfDepartment,
    statSummary: {
      totalStudents: studentRows.length,
      totalTeachers: teacherRows.length,
      averageScore,
      schoolRank,
      latestTerm: latestTerm ?? schoolLatestTerm,
      teacherStudentRatio,
    },
    classPerformance: classPerformanceRows,
    teachers: teacherRows,
    students: studentRows,
    performanceTrend: buildTrendPoints(scopedReports),
  };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export type AssessmentsInput = {
  schoolSubjectId: string;
  assessments: AssessmentRowData[];
  targets: AssessmentTargetRowData[];
  results: AssessmentResultRowData[];
  schoolSubjectClasses: DirectorySubjectClassRow[];
  classes: DirectoryClassRow[];
  teachers: DirectoryTeacherRow[];
  /** "Now" in ms; only tests pass this. */
  now?: number;
};

/** Upcoming and past assessments for one offering, with time progress and average grade. */
export function buildSubjectAssessments(input: AssessmentsInput): SubjectAssessmentsPayload {
  const { assessments, targets, results, schoolSubjectClasses, classes, teachers } = input;

  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const assessmentMap = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const schoolSubjectClassIds = new Set(schoolSubjectClasses.map((row) => row.id));
  const resultsByTarget = new Map<string, AssessmentResultRowData[]>();
  for (const result of results) {
    const list = resultsByTarget.get(result.assessment_target_id) ?? [];
    list.push(result);
    resultsByTarget.set(result.assessment_target_id, list);
  }
  const now = input.now ?? Date.now();

  const items: AssessmentTimelineItem[] = targets
    .filter((target) => {
      if (target.school_subject_class_id) {
        return schoolSubjectClassIds.has(target.school_subject_class_id);
      }

      return assessmentMap.has(target.assessment_id);
    })
    .map((target): AssessmentTimelineItem | null => {
      const assessment = assessmentMap.get(target.assessment_id);
      if (!assessment) return null;

      const targetResults = resultsByTarget.get(target.id) ?? [];
      const averageScore = average(
        targetResults.map((result) => toScore(result.normalized_pct) ?? toScore(result.raw_score)),
      );
      const classLabel = formatClassLabel(classMap.get(target.class_id));
      const teacherName = target.teacher_id
        ? teacherMap.get(target.teacher_id)?.name ?? null
        : null;
      const hasPublishedResults = targetResults.some((result) => Boolean(result.published_at));
      const startAt = target.started_at ?? assessment.scheduled_start_at;
      const endAt = assessment.scheduled_end_at;
      const progressPct =
        startAt && endAt
          ? Math.max(
              0,
              Math.min(
                100,
                ((now - new Date(startAt).getTime()) /
                  (new Date(endAt).getTime() - new Date(startAt).getTime())) *
                  100,
              ),
            )
          : null;

      return {
        id: target.id,
        assessmentId: assessment.id,
        title: assessment.title,
        description: assessment.description,
        type: assessment.type,
        term: assessment.term,
        classId: target.class_id,
        classLabel,
        teacherId: target.teacher_id,
        teacherName,
        scheduledStartAt: assessment.scheduled_start_at,
        scheduledEndAt: assessment.scheduled_end_at,
        durationMinutes: assessment.duration_minutes,
        status: target.status || assessment.status,
        startedAt: target.started_at,
        completedAt: target.completed_at,
        lingerUntil: target.linger_until,
        averageScore,
        averageGrade:
          targetResults.find((result) => result.grade)?.grade ?? scoreToGrade(averageScore),
        hasPublishedResults,
        progressPct: progressPct == null || Number.isNaN(progressPct) ? null : progressPct,
      };
    })
    .filter((item): item is AssessmentTimelineItem => Boolean(item))
    .sort((left, right) =>
      String(left.scheduledStartAt ?? "").localeCompare(String(right.scheduledStartAt ?? "")),
    );

  const upcoming: AssessmentTimelineItem[] = [];
  const past: AssessmentTimelineItem[] = [];

  for (const item of items) {
    const lingerUntil = item.lingerUntil ? new Date(item.lingerUntil).getTime() : null;
    const endTime = item.scheduledEndAt ? new Date(item.scheduledEndAt).getTime() : null;
    const completedTime = item.completedAt ? new Date(item.completedAt).getTime() : null;
    const stillLingers = lingerUntil != null && lingerUntil > now;
    const isPast =
      (completedTime != null && !stillLingers) ||
      (endTime != null && endTime < now && item.status !== "in_progress" && !stillLingers);

    if (isPast) {
      past.push(item);
    } else {
      upcoming.push(item);
    }
  }

  return {
    subjectId: input.schoolSubjectId,
    upcoming,
    past: past.sort((left, right) =>
      String(right.completedAt ?? right.scheduledEndAt ?? "").localeCompare(
        String(left.completedAt ?? left.scheduledEndAt ?? ""),
      ),
    ),
  };
}

// ---------------------------------------------------------------------------
// Coursework
// ---------------------------------------------------------------------------

export type CourseworkInput = {
  schoolSubjectId: string;
  subject: { subject_name: string; strapline: string | null; description: string | null; abstract_image_url: string | null };
  school: { id: string; name: string };
  schoolSubjectClasses: DirectorySubjectClassRow[];
  classes: DirectoryClassRow[];
  classProgress: ClassProgressRowData[];
  nodes: CurriculumNodeRowData[];
  nodeProgress: CurriculumProgressRowData[];
  resources: ResourceRowData[];
  /** When set, only this class offering's tree and resources are returned. */
  classOfferingId?: string | null;
};

/** Class offerings, syllabus progress, curriculum trees and resources for one offering. */
export function buildSubjectCoursework(input: CourseworkInput): SubjectCourseworkPayload {
  const { subject, school, schoolSubjectClasses, classes } = input;
  const requestedId = input.classOfferingId ?? null;
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  const classOfferings = schoolSubjectClasses
    .map((row) => {
      const progress = input.classProgress.find((item) => item.school_subject_class_id === row.id);
      return {
        id: row.id,
        classId: row.class_id,
        classLabel: formatClassLabel(classMap.get(row.class_id)),
        progressPct: toScore(progress?.syllabus_progress_pct),
        currentNodeId: progress?.current_node_id ?? null,
      };
    })
    .sort((left, right) => left.classLabel.localeCompare(right.classLabel));

  const curriculumByClass: Record<string, CourseworkOutlineNode[]> = {};
  const resourcesByClass: Record<string, SubjectResourceCard[]> = {};

  for (const offeringRow of classOfferings) {
    if (requestedId && offeringRow.id !== requestedId) continue;

    const nodes = input.nodes.filter((row) => row.school_subject_class_id === offeringRow.id);
    const progress = input.nodeProgress.filter((row) => row.school_subject_class_id === offeringRow.id);
    curriculumByClass[offeringRow.id] = buildCurriculumTree(nodes, progress);

    resourcesByClass[offeringRow.id] = input.resources
      .filter((row) => row.school_subject_class_id === offeringRow.id)
      .map((row) => ({
        id: row.id,
        curriculumNodeId: row.curriculum_node_id,
        resourceType: row.resource_type,
        title: row.title,
        shortDescription: row.short_description,
        authorName: row.author_name,
        coverImageUrl: row.cover_image_url,
        storagePath: row.storage_path,
        fileUrl: createSignedResourceUrl(row.storage_path),
        sourceUrl: row.source_url,
        visibility: row.visibility,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  return {
    subjectId: input.schoolSubjectId,
    title: subject.subject_name,
    strapline: truncateWords(subject.strapline, 5) ?? null,
    description: subject.description,
    abstractImageUrl: subject.abstract_image_url,
    schoolId: school.id,
    schoolName: school.name,
    classOfferings,
    curriculumByClass,
    resourcesByClass,
  };
}

// ---------------------------------------------------------------------------
// Offering codes
// ---------------------------------------------------------------------------

/**
 * The short code every school offering carries (school_subjects.custom_subject_code,
 * varchar(7), unique): three letters from the subject name + four digits, e.g. "MAT0427".
 * Why here: the old Supabase project filled it with a database trigger; plain PostgreSQL
 * has no such trigger, so the repository computes it (and retries on a clash).
 *
 * @param label       subject name (or code) the letters are taken from
 * @param randomDigits returns 0-9999; only tests pass their own
 */
export function buildCustomSubjectCode(label: string, randomDigits: () => number): string {
  const letters = label.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X");
  return letters + String(randomDigits()).padStart(4, "0");
}
