import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SUBJECT_RESOURCES_BUCKET,
  average,
  formatClassLabel,
  formatEnumLabel,
  getRolePriority,
  scoreToGrade,
  toScore,
  truncateWords,
  type AssessmentTimelineItem,
  type ClassFormOption,
  type CourseworkOutlineNode,
  type SchoolFormOption,
  type SubjectAssessmentsPayload,
  type SubjectCourseworkPayload,
  type SubjectDetailPayload,
  type SubjectDirectoryCard,
  type SubjectDirectoryPayload,
  type SubjectFormOption,
  type SubjectPerformancePoint,
  type SubjectResourceCard,
  type SubjectStudentRow,
  type SubjectTeacherRow,
  type TeacherFormOption,
} from "@/lib/subjects";

type SchoolSubjectRow = {
  id: string;
  school_id: string;
  subject_id: number;
  created_at: string | null;
};

type SubjectRow = {
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

type SchoolRow = {
  id: string;
  name: string;
};

type ClassRow = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
};

type SchoolSubjectClassRow = {
  id: string;
  school_subject_id: string;
  class_id: string;
  display_order: number;
};

type TeacherSubjectRow = {
  id: string;
  teacher_id: string;
  subject_id: number;
  school_id: string;
  is_primary: boolean;
  school_subject_id: string | null;
  assignment_role: string;
};

type TeacherRow = {
  id: string;
  school_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
};

type TeacherTimetableRow = {
  teacher_id: string;
  class_id: string | null;
  subject_id: number | string | null;
};

type StudentSubjectRow = {
  student_id: string;
  subject_id: number;
  teacher_id: string | null;
  school_subject_id: string | null;
  school_id: string | null;
  is_active: boolean;
};

type StudentRow = {
  id: string;
  school_id: string;
  admission_no: string;
  class_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone2: string | null;
  profile_picture: string | null;
  status: string;
};

type GradingReportRow = {
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

type ClassSubjectPerformanceRow = {
  id: string;
  class_id: string;
  subject_id: number;
  average_score: number | string | null;
  average_grade: string | null;
  school_subject_id: string | null;
};

type AssessmentRow = {
  id: string;
  school_id: string;
  school_subject_id: string;
  type: string;
  title: string;
  description: string | null;
  term: string | null;
  total_marks_raw: number | string | null;
  duration_minutes: number | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  status: string;
};

type AssessmentTargetRow = {
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

type AssessmentResultRow = {
  id: string;
  assessment_target_id: string;
  student_id: string;
  raw_score: number | string | null;
  normalized_pct: number | string | null;
  grade: string | null;
  remarks: string | null;
  published_at: string | null;
};

type SubjectClassProgressRow = {
  id: string;
  school_subject_class_id: string;
  current_node_id: string | null;
  syllabus_progress_pct: number | string | null;
  updated_at: string | null;
};

type SubjectCurriculumNodeRow = {
  id: string;
  school_subject_class_id: string;
  parent_id: string | null;
  title: string;
  node_type: string;
  sort_order: number;
  depth: number;
};

type SubjectCurriculumProgressRow = {
  id: string;
  school_subject_class_id: string;
  curriculum_node_id: string;
  completion_state: "pending" | "partial" | "complete";
  completed_at: string | null;
};

type SubjectResourceRow = {
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

function isMissingRelationError(error: { message?: string } | null | undefined) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
}

function unwrapResult<T>(
  result: { data: T | null; error: { message: string } | null },
  fallback: T,
  allowMissing = false,
) {
  if (result.error) {
    if (allowMissing && isMissingRelationError(result.error)) {
      return fallback;
    }

    throw new Error(result.error.message);
  }

  return result.data ?? fallback;
}

function subjectSchoolKey(schoolId: string, subjectId: number) {
  return `${schoolId}:${subjectId}`;
}

function matchesOfferingByBridge(
  offering: SchoolSubjectRow,
  row: { school_subject_id: string | null; subject_id: number; school_id: string | null },
) {
  return (
    row.school_subject_id === offering.id ||
    (!row.school_subject_id &&
      row.subject_id === offering.subject_id &&
      row.school_id === offering.school_id)
  );
}

function getStudentName(student: StudentRow) {
  const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();
  return fullName || "Unnamed student";
}

function getSubjectScore(report: {
  normalized_pct: number | string | null;
  raw_score: number | string | null;
}) {
  return toScore(report.normalized_pct) ?? toScore(report.raw_score);
}

function getLatestTerm(rows: GradingReportRow[]) {
  const sorted = [...rows].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
  );
  return sorted[0]?.term ?? null;
}

function buildTrendPoints(reports: GradingReportRow[]): SubjectPerformancePoint[] {
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
  nodes: SubjectCurriculumNodeRow[],
  progressRows: SubjectCurriculumProgressRow[],
) {
  const progressMap = new Map(
    progressRows.map((row) => [
      row.curriculum_node_id,
      {
        completionState: row.completion_state,
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

export async function ensureSubjectResourcesBucket() {
  const currentBucket = await supabaseAdmin.storage.getBucket(SUBJECT_RESOURCES_BUCKET);
  if (!currentBucket.error && currentBucket.data) {
    return;
  }

  const createdBucket = await supabaseAdmin.storage.createBucket(
    SUBJECT_RESOURCES_BUCKET,
    {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024,
    },
  );

  if (
    createdBucket.error &&
    !createdBucket.error.message.toLowerCase().includes("already exists")
  ) {
    throw new Error(createdBucket.error.message);
  }
}

export async function getSubjectFormOptions() {
  const [schoolsRes, classesRes, teachersRes, subjectsRes] = await Promise.all([
    supabaseAdmin.from("schools").select("id, name").order("name", { ascending: true }),
    supabaseAdmin
      .from("classes")
      .select("id, school_id, class_name, stream")
      .order("class_name", { ascending: true }),
    supabaseAdmin
      .from("teachers")
      .select("id, school_id, name, email, phone, profile_photo")
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("subjects")
      .select("id, subject_name, subject_code")
      .order("subject_name", { ascending: true }),
  ]);

  return {
    schools: unwrapResult(schoolsRes, [] as SchoolFormOption[]),
    classes: unwrapResult(classesRes, [] as ClassFormOption[]),
    teachers: unwrapResult(teachersRes, [] as TeacherFormOption[]),
    masterSubjects: unwrapResult(subjectsRes, [] as SubjectFormOption[]),
  };
}

export async function getSchoolSubjectOrThrow(schoolSubjectId: string) {
  const schoolSubjectRes = await supabaseAdmin
    .from("school_subjects")
    .select("id, school_id, subject_id, created_at")
    .eq("id", schoolSubjectId)
    .maybeSingle();

  const offering = unwrapResult(schoolSubjectRes, null as SchoolSubjectRow | null);
  if (!offering) {
    throw new Error("Subject offering not found.");
  }

  return offering;
}

export async function getSubjectDirectoryData(): Promise<SubjectDirectoryPayload> {
  const [
    options,
    schoolSubjectsRes,
    subjectsRes,
    schoolsRes,
    classesRes,
    schoolSubjectClassesRes,
    teacherSubjectsRes,
    teachersRes,
    studentSubjectsRes,
    gradingReportsRes,
    classPerformanceRes,
  ] = await Promise.all([
    getSubjectFormOptions(),
    supabaseAdmin.from("school_subjects").select("id, school_id, subject_id, created_at"),
    supabaseAdmin.from("subjects").select(`
      id,
      subject_name,
      subject_code,
      acronym,
      short_name,
      strapline,
      description,
      department,
      category,
      subject_type,
      education_level,
      requires_lab,
      has_coursework,
      has_assessments,
      is_elective,
      is_active,
      default_sequence,
      theme_token,
      abstract_image_url
    `),
    supabaseAdmin.from("schools").select("id, name"),
    supabaseAdmin.from("classes").select("id, school_id, class_name, stream"),
    supabaseAdmin
      .from("school_subject_classes")
      .select("id, school_subject_id, class_id, display_order"),
    supabaseAdmin
      .from("teacher_subjects")
      .select(
        "id, teacher_id, subject_id, school_id, is_primary, school_subject_id, assignment_role",
      ),
    supabaseAdmin
      .from("teachers")
      .select("id, school_id, name, email, phone, profile_photo"),
    supabaseAdmin
      .from("student_subjects")
      .select("student_id, subject_id, teacher_id, school_subject_id, school_id, is_active"),
    supabaseAdmin
      .from("grading_reports")
      .select(
        "id, student_id, subject_id, term, class_id, grade, teacher_id, created_at, school_subject_id, raw_score, normalized_pct",
      ),
    supabaseAdmin
      .from("class_subject_performance")
      .select("id, class_id, subject_id, average_score, average_grade, school_subject_id"),
  ]);

  const offerings = unwrapResult(schoolSubjectsRes, [] as SchoolSubjectRow[]);
  const subjects = unwrapResult(subjectsRes, [] as SubjectRow[]);
  const schools = unwrapResult(schoolsRes, [] as SchoolRow[]);
  const classes = unwrapResult(classesRes, [] as ClassRow[]);
  const schoolSubjectClasses = unwrapResult(
    schoolSubjectClassesRes,
    [] as SchoolSubjectClassRow[],
  );
  const teacherSubjects = unwrapResult(teacherSubjectsRes, [] as TeacherSubjectRow[]);
  const teachers = unwrapResult(teachersRes, [] as TeacherRow[]);
  const studentSubjects = unwrapResult(studentSubjectsRes, [] as StudentSubjectRow[]);
  const gradingReports = unwrapResult(gradingReportsRes, [] as GradingReportRow[]);
  const classPerformance = unwrapResult(
    classPerformanceRes,
    [] as ClassSubjectPerformanceRow[],
  );

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

export async function getSubjectDetailData(
  schoolSubjectId: string,
): Promise<SubjectDetailPayload> {
  const offering = await getSchoolSubjectOrThrow(schoolSubjectId);

  const [
    subjectRes,
    schoolRes,
    schoolSubjectClassesRes,
    classesRes,
    teacherSubjectsRes,
    teachersRes,
    teacherTimetablesRes,
    studentSubjectsRes,
    studentsRes,
    gradingReportsRes,
    classPerformanceRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("subjects")
      .select(`
        id,
        subject_name,
        subject_code,
        acronym,
        short_name,
        strapline,
        description,
        department,
        category,
        subject_type,
        education_level,
        requires_lab,
        has_coursework,
        has_assessments,
        is_elective,
        is_active,
        default_sequence,
        theme_token,
        abstract_image_url
      `)
      .eq("id", offering.subject_id)
      .maybeSingle(),
    supabaseAdmin
      .from("schools")
      .select("id, name")
      .eq("id", offering.school_id)
      .maybeSingle(),
    supabaseAdmin
      .from("school_subject_classes")
      .select("id, school_subject_id, class_id, display_order")
      .eq("school_subject_id", schoolSubjectId),
    supabaseAdmin
      .from("classes")
      .select("id, school_id, class_name, stream")
      .eq("school_id", offering.school_id),
    supabaseAdmin
      .from("teacher_subjects")
      .select(
        "id, teacher_id, subject_id, school_id, is_primary, school_subject_id, assignment_role",
      )
      .eq("school_id", offering.school_id)
      .eq("subject_id", offering.subject_id),
    supabaseAdmin
      .from("teachers")
      .select("id, school_id, name, email, phone, profile_photo")
      .eq("school_id", offering.school_id),
    supabaseAdmin
      .from("teacher_timetables")
      .select("teacher_id, class_id, subject_id")
      .eq("subject_id", offering.subject_id),
    supabaseAdmin
      .from("student_subjects")
      .select("student_id, subject_id, teacher_id, school_subject_id, school_id, is_active")
      .eq("subject_id", offering.subject_id),
    supabaseAdmin
      .from("students")
      .select(
        "id, school_id, admission_no, class_id, first_name, last_name, phone, phone2, profile_picture, status",
      )
      .eq("school_id", offering.school_id),
    supabaseAdmin
      .from("grading_reports")
      .select(
        "id, student_id, subject_id, term, class_id, grade, teacher_id, created_at, school_subject_id, raw_score, normalized_pct",
      )
      .eq("subject_id", offering.subject_id),
    supabaseAdmin
      .from("class_subject_performance")
      .select("id, class_id, subject_id, average_score, average_grade, school_subject_id")
      .eq("subject_id", offering.subject_id),
  ]);

  const subject = unwrapResult(subjectRes, null as SubjectRow | null);
  const school = unwrapResult(schoolRes, null as SchoolRow | null);
  const schoolSubjectClasses = unwrapResult(
    schoolSubjectClassesRes,
    [] as SchoolSubjectClassRow[],
  );
  const classes = unwrapResult(classesRes, [] as ClassRow[]);
  const teacherSubjects = unwrapResult(teacherSubjectsRes, [] as TeacherSubjectRow[]).filter(
    (row) => matchesOfferingByBridge(offering, row),
  );
  const teachers = unwrapResult(teachersRes, [] as TeacherRow[]);
  const teacherTimetables = unwrapResult(
    teacherTimetablesRes,
    [] as TeacherTimetableRow[],
  ).filter((row) => Number(row.subject_id) === offering.subject_id);
  const studentSubjects = unwrapResult(studentSubjectsRes, [] as StudentSubjectRow[]).filter(
    (row) => matchesOfferingByBridge(offering, row),
  );
  const students = unwrapResult(studentsRes, [] as StudentRow[]);
  const gradingReports = unwrapResult(gradingReportsRes, [] as GradingReportRow[]);
  const classPerformance = unwrapResult(
    classPerformanceRes,
    [] as ClassSubjectPerformanceRow[],
  );

  if (!subject || !school) {
    throw new Error("Subject detail could not be loaded.");
  }

  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const studentMap = new Map(
    students
      .filter((student) => student.school_id === offering.school_id)
      .map((student) => [student.id, student] as const),
  );
  const offeredClassIds = new Set(schoolSubjectClasses.map((row) => row.class_id));

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

  const allSchoolReports = gradingReports.filter((row) => {
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
          teacherTimetables
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

  const performanceRows = classPerformance.filter((row) => {
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

export async function getSubjectAssessmentsData(
  schoolSubjectId: string,
): Promise<SubjectAssessmentsPayload> {
  const offering = await getSchoolSubjectOrThrow(schoolSubjectId);

  const [
    assessmentsRes,
    targetsRes,
    resultsRes,
    schoolSubjectClassesRes,
    classesRes,
    teachersRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("assessments")
      .select(`
        id,
        school_id,
        school_subject_id,
        type,
        title,
        description,
        term,
        total_marks_raw,
        duration_minutes,
        scheduled_start_at,
        scheduled_end_at,
        status
      `)
      .eq("school_subject_id", schoolSubjectId),
    supabaseAdmin
      .from("assessment_targets")
      .select(`
        id,
        assessment_id,
        school_subject_class_id,
        class_id,
        teacher_id,
        status,
        started_at,
        completed_at,
        linger_until
      `),
    supabaseAdmin
      .from("assessment_results")
      .select(`
        id,
        assessment_target_id,
        student_id,
        raw_score,
        normalized_pct,
        grade,
        remarks,
        published_at
      `),
    supabaseAdmin
      .from("school_subject_classes")
      .select("id, school_subject_id, class_id, display_order")
      .eq("school_subject_id", schoolSubjectId),
    supabaseAdmin
      .from("classes")
      .select("id, school_id, class_name, stream")
      .eq("school_id", offering.school_id),
    supabaseAdmin
      .from("teachers")
      .select("id, school_id, name, email, phone, profile_photo")
      .eq("school_id", offering.school_id),
  ]);

  const assessments = unwrapResult(assessmentsRes, [] as AssessmentRow[], true);
  const targets = unwrapResult(targetsRes, [] as AssessmentTargetRow[], true);
  const results = unwrapResult(resultsRes, [] as AssessmentResultRow[], true);
  const schoolSubjectClasses = unwrapResult(
    schoolSubjectClassesRes,
    [] as SchoolSubjectClassRow[],
    true,
  );
  const classes = unwrapResult(classesRes, [] as ClassRow[]);
  const teachers = unwrapResult(teachersRes, [] as TeacherRow[]);

  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const schoolSubjectClassIds = new Set(schoolSubjectClasses.map((row) => row.id));
  const now = Date.now();

  const items: AssessmentTimelineItem[] = targets
    .filter((target) => {
      if (target.school_subject_class_id) {
        return schoolSubjectClassIds.has(target.school_subject_class_id);
      }

      return assessments.some((assessment) => assessment.id === target.assessment_id);
    })
    .map((target) => {
      const assessment = assessments.find((row) => row.id === target.assessment_id);
      if (!assessment) return null;

      const targetResults = results.filter(
        (result) => result.assessment_target_id === target.id,
      );
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
      } satisfies AssessmentTimelineItem;
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
    subjectId: schoolSubjectId,
    upcoming,
    past: past.sort((left, right) =>
      String(right.completedAt ?? right.scheduledEndAt ?? "").localeCompare(
        String(left.completedAt ?? left.scheduledEndAt ?? ""),
      ),
    ),
  };
}

export async function getSubjectCourseworkData(
  schoolSubjectId: string,
): Promise<SubjectCourseworkPayload> {
  const offering = await getSchoolSubjectOrThrow(schoolSubjectId);

  const [
    subjectRes,
    schoolRes,
    schoolSubjectClassesRes,
    classesRes,
    classProgressRes,
    curriculumNodesRes,
    curriculumProgressRes,
    resourcesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("subjects")
      .select("id, subject_name, strapline, description, abstract_image_url")
      .eq("id", offering.subject_id)
      .maybeSingle(),
    supabaseAdmin.from("schools").select("id, name").eq("id", offering.school_id).maybeSingle(),
    supabaseAdmin
      .from("school_subject_classes")
      .select("id, school_subject_id, class_id, display_order")
      .eq("school_subject_id", schoolSubjectId),
    supabaseAdmin
      .from("classes")
      .select("id, school_id, class_name, stream")
      .eq("school_id", offering.school_id),
    supabaseAdmin
      .from("subject_class_progress")
      .select("id, school_subject_class_id, current_node_id, syllabus_progress_pct, updated_at"),
    supabaseAdmin
      .from("subject_curriculum_nodes")
      .select("id, school_subject_class_id, parent_id, title, node_type, sort_order, depth"),
    supabaseAdmin
      .from("subject_curriculum_progress")
      .select("id, school_subject_class_id, curriculum_node_id, completion_state, completed_at"),
    supabaseAdmin
      .from("subject_resources")
      .select(`
        id,
        school_subject_class_id,
        curriculum_node_id,
        resource_type,
        title,
        short_description,
        author_name,
        cover_image_url,
        storage_path,
        source_url,
        visibility,
        uploaded_by,
        uploaded_at
      `),
  ]);

  const subject = unwrapResult(
    subjectRes,
    null as {
      id: number;
      subject_name: string;
      strapline: string | null;
      description: string | null;
      abstract_image_url: string | null;
    } | null,
  );
  const school = unwrapResult(schoolRes, null as SchoolRow | null);
  const schoolSubjectClasses = unwrapResult(
    schoolSubjectClassesRes,
    [] as SchoolSubjectClassRow[],
  );
  const classes = unwrapResult(classesRes, [] as ClassRow[]);
  const classProgressRows = unwrapResult(
    classProgressRes,
    [] as SubjectClassProgressRow[],
    true,
  );
  const curriculumNodes = unwrapResult(
    curriculumNodesRes,
    [] as SubjectCurriculumNodeRow[],
    true,
  );
  const curriculumProgressRows = unwrapResult(
    curriculumProgressRes,
    [] as SubjectCurriculumProgressRow[],
    true,
  );
  const resourceRows = unwrapResult(resourcesRes, [] as SubjectResourceRow[], true);

  if (!subject || !school) {
    throw new Error("Coursework payload could not be loaded.");
  }

  const classMap = new Map(classes.map((classItem) => [classItem.id, classItem]));

  const classOfferings = schoolSubjectClasses
    .map((row) => {
      const progress = classProgressRows.find(
        (item) => item.school_subject_class_id === row.id,
      );
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
    const nodes = curriculumNodes.filter(
      (row) => row.school_subject_class_id === offeringRow.id,
    );
    const progress = curriculumProgressRows.filter(
      (row) => row.school_subject_class_id === offeringRow.id,
    );
    curriculumByClass[offeringRow.id] = buildCurriculumTree(nodes, progress);

    resourcesByClass[offeringRow.id] = resourceRows
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
        sourceUrl: row.source_url,
        visibility: row.visibility,
        uploadedBy: row.uploaded_by,
        uploadedAt: row.uploaded_at,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  return {
    subjectId: schoolSubjectId,
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

export function buildSubjectResourcePath(args: {
  schoolId: string;
  subjectId: number;
  classId: string;
  filename: string;
}) {
  const safeName = args.filename.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  return `${args.schoolId}/${args.subjectId}/${args.classId}/${Date.now()}-${safeName}`;
}

export function createSignedResourceUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null;
  return `/api/subjects/resource?path=${encodeURIComponent(storagePath)}`;
}

export function formatSubjectMetaLabel(value: string | null | undefined) {
  return formatEnumLabel(value);
}
