// =============================================================================
// Subject directory builder — pure, database-free.
// -----------------------------------------------------------------------------
// Both data backends (legacy Supabase in lib/subjects-server.ts, Prisma in
// lib/repositories/subject.repo.ts) load the same rows for ONE school and hand
// them to buildSubjectDirectory(). Keeping the maths here, once, is what
// guarantees GET /api/subjects returns the SAME JSON whichever backend is on.
//
// Rows use the database column names (snake_case) with numbers/strings only:
// BigInt -> number, Decimal -> number|string, Date -> ISO string. That also makes
// the result safe to cache (a cache hit round-trips through JSON).
// =============================================================================

import {
  average,
  formatClassLabel,
  getRolePriority,
  toScore,
  truncateWords,
  type ClassFormOption,
  type SchoolFormOption,
  type SubjectDirectoryCard,
  type SubjectDirectoryPayload,
  type SubjectFormOption,
  type TeacherFormOption,
} from "@/lib/subjects";

export type DirectoryOfferingRow = {
  id: string;
  school_id: string;
  subject_id: number;
  created_at: string | null;
};

export type DirectorySubjectRow = {
  id: number;
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
};

export type DirectoryClassRow = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
};

export type DirectorySubjectClassRow = {
  id: string;
  school_subject_id: string;
  class_id: string;
  display_order: number;
};

export type DirectoryTeacherSubjectRow = {
  id: string;
  teacher_id: string;
  subject_id: number;
  school_id: string;
  is_primary: boolean;
  school_subject_id: string | null;
  assignment_role: string;
};

export type DirectoryTeacherRow = {
  id: string;
  school_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
};

export type DirectoryStudentSubjectRow = {
  student_id: string;
  subject_id: number;
  teacher_id: string | null;
  school_subject_id: string | null;
  school_id: string | null;
  is_active: boolean;
};

/** Only the grading columns the directory needs (keeps the Prisma read light). */
export type DirectoryGradingRow = {
  subject_id: number;
  term: string;
  class_id: string;
  created_at: string | null;
  school_subject_id: string | null;
  raw_score: number | string | null;
  normalized_pct: number | string | null;
};

export type DirectoryPerformanceRow = {
  id: string;
  class_id: string;
  subject_id: number;
  average_score: number | string | null;
  average_grade: string | null;
  school_subject_id: string | null;
};

export type DirectoryInput = {
  /** Form option lists, already limited to the caller's school (master subjects are the shared catalogue). */
  options: {
    schools: SchoolFormOption[];
    classes: ClassFormOption[];
    teachers: TeacherFormOption[];
    masterSubjects: SubjectFormOption[];
  };
  offerings: DirectoryOfferingRow[];
  subjects: DirectorySubjectRow[];
  schools: Array<{ id: string; name: string }>;
  classes: DirectoryClassRow[];
  schoolSubjectClasses: DirectorySubjectClassRow[];
  teacherSubjects: DirectoryTeacherSubjectRow[];
  teachers: DirectoryTeacherRow[];
  studentSubjects: DirectoryStudentSubjectRow[];
  gradingReports: DirectoryGradingRow[];
  classPerformance: DirectoryPerformanceRow[];
};

/** A grade row's score: the normalised percentage when present, else the raw score. */
export function getSubjectScore(report: {
  normalized_pct: number | string | null;
  raw_score: number | string | null;
}) {
  return toScore(report.normalized_pct) ?? toScore(report.raw_score);
}

/** The term of the most recently created row, or null when there are no rows. */
export function getLatestTerm(rows: Array<{ term: string; created_at: string | null }>) {
  const sorted = [...rows].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
  );
  return sorted[0]?.term ?? null;
}

/**
 * Does a bridge row (teacher/student link) belong to this offering? New rows carry
 * school_subject_id; older rows only carry subject_id + school_id.
 */
export function matchesOfferingByBridge(
  offering: { id: string; subject_id: number; school_id: string },
  row: { school_subject_id: string | null; subject_id: number; school_id: string | null },
) {
  return (
    row.school_subject_id === offering.id ||
    (!row.school_subject_id &&
      row.subject_id === offering.subject_id &&
      row.school_id === offering.school_id)
  );
}

function subjectSchoolKey(schoolId: string, subjectId: number) {
  return `${schoolId}:${subjectId}`;
}

/**
 * Build the directory payload (cards + filter/form options) from one school's rows.
 *
 * Why it exists: the admin Subjects page shows one card per school offering with
 * classes, teaching team, headcount, average score and school rank; this is the
 * single place that computes them.
 */
export function buildSubjectDirectory(input: DirectoryInput): SubjectDirectoryPayload {
  const {
    options,
    offerings,
    subjects,
    schools,
    classes,
    schoolSubjectClasses,
    teacherSubjects,
    teachers,
    studentSubjects,
    gradingReports,
    classPerformance,
  } = input;

  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const schoolMap = new Map(schools.map((school) => [school.id, school.name]));
  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const offeringBySubjectSchool = new Map(
    offerings.map((offering) => [
      subjectSchoolKey(offering.school_id, offering.subject_id),
      offering.id,
    ]),
  );

  const departments = Array.from(
    new Set(subjects.map((subject) => subject.department).filter(Boolean) as string[]),
  ).sort((left, right) => left.localeCompare(right));

  const rankingBySchool = new Map<string, Map<string, number>>();
  const latestTermBySchool = new Map<string, string | null>();

  for (const school of schools) {
    const rowsForSchool = gradingReports.filter((row) => {
      const classItem = classMap.get(row.class_id);
      return classItem?.school_id === school.id;
    });
    const latestTerm = getLatestTerm(rowsForSchool);
    latestTermBySchool.set(school.id, latestTerm);
    if (!latestTerm) continue;

    const scopedRows = rowsForSchool.filter((row) => row.term === latestTerm);
    const aggregate = new Map<string, number[]>();

    for (const row of scopedRows) {
      const offeringId =
        row.school_subject_id ??
        offeringBySubjectSchool.get(subjectSchoolKey(school.id, row.subject_id));
      if (!offeringId) continue;
      const score = getSubjectScore(row);
      if (score == null) continue;
      const existing = aggregate.get(offeringId) ?? [];
      existing.push(score);
      aggregate.set(offeringId, existing);
    }

    const ranked = Array.from(aggregate.entries())
      .map(([offeringId, scores]) => ({
        offeringId,
        averageScore: average(scores) ?? 0,
      }))
      .sort((left, right) => right.averageScore - left.averageScore);

    rankingBySchool.set(
      school.id,
      new Map(ranked.map((item, index) => [item.offeringId, index + 1])),
    );
  }

  const cards: SubjectDirectoryCard[] = offerings
    .flatMap((offering) => {
      const subject = subjectMap.get(offering.subject_id);
      if (!subject) return [];

      const relatedClasses = schoolSubjectClasses
        .filter((row) => row.school_subject_id === offering.id)
        .sort((left, right) => left.display_order - right.display_order)
        .map((row) => ({
          id: row.class_id,
          label: formatClassLabel(classMap.get(row.class_id)),
        }));

      const relatedTeacherLinks = teacherSubjects.filter((row) =>
        matchesOfferingByBridge(offering, row),
      );
      const relatedTeacherEntries = relatedTeacherLinks
        .sort(
          (left, right) =>
            getRolePriority(left.assignment_role) -
            getRolePriority(right.assignment_role),
        )
        .flatMap((row) => {
          const teacher = teacherMap.get(row.teacher_id);
          if (!teacher) return [];

          return [
            [
              row.teacher_id,
              {
                id: teacher.id,
                name: teacher.name,
                profilePhoto: teacher.profile_photo,
                role: row.assignment_role,
              },
            ] as const,
          ];
        });
      const relatedTeachers = Array.from(new Map(relatedTeacherEntries).values());

      const relatedStudents = studentSubjects.filter((row) =>
        matchesOfferingByBridge(offering, row),
      );

      const latestTerm = latestTermBySchool.get(offering.school_id) ?? null;
      const relevantReports = gradingReports.filter((row) => {
        if (latestTerm && row.term !== latestTerm) return false;
        if (row.school_subject_id) return row.school_subject_id === offering.id;
        const classItem = classMap.get(row.class_id);
        return (
          classItem?.school_id === offering.school_id &&
          row.subject_id === offering.subject_id
        );
      });

      const currentPerformance = classPerformance.filter((row) => {
        if (row.school_subject_id) return row.school_subject_id === offering.id;
        const classItem = classMap.get(row.class_id);
        return (
          classItem?.school_id === offering.school_id &&
          row.subject_id === offering.subject_id
        );
      });

      const averageScore =
        average(relevantReports.map((row) => getSubjectScore(row))) ??
        average(currentPerformance.map((row) => toScore(row.average_score)));

      return [
        {
          id: offering.id,
          schoolId: offering.school_id,
          schoolName: schoolMap.get(offering.school_id) ?? "Unknown school",
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
          classes: relatedClasses,
          teachers: relatedTeachers.slice(0, 5),
          totalStudents: relatedStudents.filter((row) => row.is_active).length,
          totalTeachers: relatedTeachers.length,
          averageScore,
          schoolRank: rankingBySchool.get(offering.school_id)?.get(offering.id) ?? null,
          latestTerm,
        } satisfies SubjectDirectoryCard,
      ];
    })
    .sort((left, right) => {
      const scoreGap = (right.averageScore ?? -1) - (left.averageScore ?? -1);
      if (scoreGap !== 0) return scoreGap;
      return left.title.localeCompare(right.title);
    });

  return {
    cards,
    options: {
      ...options,
      departments,
    },
  };
}
