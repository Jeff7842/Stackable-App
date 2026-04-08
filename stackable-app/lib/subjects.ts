export const SUBJECT_RESOURCES_BUCKET = "subject_resources";
export const SUBJECT_BACKGROUND_BUCKET = "subject_backgrounds";

export const SUBJECT_ABSTRACT_IMAGES = [
  "/abstract/1586742_4393.jpg",
  "/abstract/166363497_497acf43-f4f9-4aa6-9e5b-7e426bcef088.jpg",
  "/abstract/371667258537.jpg",
  "/abstract/456252907914.jpg",
  "/abstract/5739662.jpg",
  "/abstract/653.jpg",
  "/abstract/7150088_3551288.jpg",
  "/abstract/7731493.jpg",
  "/abstract/7995188.jpg",
  "/abstract/8a2e3e15-3ec7-4d55-86b4-e8c6cb33fd17.jpg",
  "/abstract/fd306b7b-bb63-431d-a70c-035f1477195a.jpg",
] as const;

export const SUBJECT_CATEGORY_OPTIONS = [
  "core",
  "elective",
  "technical",
  "language",
  "humanities",
  "science",
  "arts",
  "vocational",
  "school-based",
] as const;

export const SUBJECT_TYPE_OPTIONS = [
  "general",
  "language",
  "science",
  "humanities",
  "technical",
  "creative",
  "religious",
  "vocational",
  "club",
  "special",
] as const;

export const EDUCATION_LEVEL_OPTIONS = [
  "primary",
  "junior-secondary",
  "secondary",
  "advanced",
  "mixed",
] as const;

export const ASSIGNMENT_ROLE_OPTIONS = [
  "hod",
  "lead",
  "teacher",
  "assistant",
  "examiner",
] as const;

export const ASSESSMENT_TYPE_OPTIONS = [
  "cat",
  "exam",
  "rat",
  "quiz",
] as const;

export const ASSESSMENT_STATUS_OPTIONS = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "published",
] as const;

export const CURRICULUM_NODE_TYPE_OPTIONS = [
  "topic",
  "subtopic",
  "subtopic_item",
] as const;

export const RESOURCE_TYPE_OPTIONS = [
  "video",
  "document",
  "book",
  "link",
  "audio",
] as const;

export const RESOURCE_VISIBILITY_OPTIONS = [
  "private",
  "public",
] as const;

export type SubjectCategory = (typeof SUBJECT_CATEGORY_OPTIONS)[number];
export type SubjectType = (typeof SUBJECT_TYPE_OPTIONS)[number];
export type EducationLevel = (typeof EDUCATION_LEVEL_OPTIONS)[number];
export type AssignmentRole = (typeof ASSIGNMENT_ROLE_OPTIONS)[number];
export type AssessmentType = (typeof ASSESSMENT_TYPE_OPTIONS)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUS_OPTIONS)[number];
export type CurriculumNodeType = (typeof CURRICULUM_NODE_TYPE_OPTIONS)[number];
export type ResourceType = (typeof RESOURCE_TYPE_OPTIONS)[number];
export type ResourceVisibility = (typeof RESOURCE_VISIBILITY_OPTIONS)[number];

export type SubjectFormOption = {
  id: number;
  subject_name: string;
  subject_code: string | null;
};

export type SchoolFormOption = {
  id: string;
  name: string;
};

export type ClassFormOption = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
};

export type TeacherFormOption = {
  id: string;
  school_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profile_photo: string | null;
};

export type SubjectDirectoryCard = {
  id: string;
  schoolId: string;
  schoolName: string;
  subjectId: number;
  title: string;
  subjectCode: string | null;
  acronym: string | null;
  shortName: string | null;
  strapline: string | null;
  description: string | null;
  department: string | null;
  category: SubjectCategory | string;
  subjectType: SubjectType | string;
  educationLevel: EducationLevel | string;
  requiresLab: boolean;
  hasCoursework: boolean;
  hasAssessments: boolean;
  isElective: boolean;
  isActive: boolean;
  themeToken: string | null;
  abstractImageUrl: string | null;
  classes: Array<{
    id: string;
    label: string;
  }>;
  teachers: Array<{
    id: string;
    name: string;
    profilePhoto: string | null;
    role: string;
  }>;
  totalStudents: number;
  totalTeachers: number;
  averageScore: number | null;
  schoolRank: number | null;
  latestTerm: string | null;
};

export type SubjectDirectoryPayload = {
  cards: SubjectDirectoryCard[];
  options: {
    schools: SchoolFormOption[];
    classes: ClassFormOption[];
    teachers: TeacherFormOption[];
    masterSubjects: SubjectFormOption[];
    departments: string[];
  };
};

export type SubjectTeacherRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  profilePhoto: string | null;
  role: string;
  isPrimary: boolean;
  classes: string[];
  learnerAverage: number | null;
};

export type SubjectStudentRow = {
  id: string;
  fullName: string;
  admissionNo: string;
  classLabel: string;
  avgScore: number | null;
  grade: string;
  teacherName: string | null;
  profilePhoto: string | null;
  status: string;
};

export type SubjectClassPerformanceRow = {
  id: string;
  classId: string;
  classLabel: string;
  averageScore: number | null;
  averageGrade: string | null;
};

export type SubjectPerformancePoint = {
  label: string;
  averageScore: number | null;
  recentAverage: number | null;
};

export type SubjectDetailPayload = {
  id: string;
  schoolId: string;
  schoolName: string;
  subjectId: number;
  title: string;
  subjectCode: string | null;
  acronym: string | null;
  shortName: string | null;
  strapline: string | null;
  description: string | null;
  department: string | null;
  category: string;
  subjectType: string;
  educationLevel: string;
  requiresLab: boolean;
  hasCoursework: boolean;
  hasAssessments: boolean;
  isElective: boolean;
  isActive: boolean;
  themeToken: string | null;
  abstractImageUrl: string | null;
  headOfDepartment: SubjectTeacherRow | null;
  statSummary: {
    totalStudents: number;
    totalTeachers: number;
    averageScore: number | null;
    schoolRank: number | null;
    latestTerm: string | null;
    teacherStudentRatio: number | null;
  };
  classPerformance: SubjectClassPerformanceRow[];
  teachers: SubjectTeacherRow[];
  students: SubjectStudentRow[];
  performanceTrend: SubjectPerformancePoint[];
};

export type AssessmentTimelineItem = {
  id: string;
  assessmentId: string;
  title: string;
  description: string | null;
  type: string;
  term: string | null;
  classId: string;
  classLabel: string;
  teacherId: string | null;
  teacherName: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  durationMinutes: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  lingerUntil: string | null;
  averageScore: number | null;
  averageGrade: string | null;
  hasPublishedResults: boolean;
  progressPct: number | null;
};

export type SubjectAssessmentsPayload = {
  subjectId: string;
  upcoming: AssessmentTimelineItem[];
  past: AssessmentTimelineItem[];
};

export type CourseworkOutlineNode = {
  id: string;
  parentId: string | null;
  title: string;
  nodeType: string;
  sortOrder: number;
  depth: number;
  completionState: "pending" | "partial" | "complete";
  completedAt: string | null;
  children: CourseworkOutlineNode[];
};

export type SubjectResourceCard = {
  id: string;
  curriculumNodeId: string | null;
  resourceType: ResourceType | string;
  title: string;
  shortDescription: string | null;
  authorName: string | null;
  coverImageUrl: string | null;
  storagePath: string | null;
  sourceUrl: string | null;
  visibility: ResourceVisibility | string;
  uploadedBy: string | null;
  uploadedAt: string | null;
};

export type SubjectCourseworkClassOption = {
  id: string;
  classId: string;
  classLabel: string;
  progressPct: number | null;
  currentNodeId: string | null;
};

export type SubjectCourseworkPayload = {
  subjectId: string;
  title: string;
  strapline: string | null;
  description: string | null;
  abstractImageUrl: string | null;
  schoolId: string;
  schoolName: string;
  classOfferings: SubjectCourseworkClassOption[];
  curriculumByClass: Record<string, CourseworkOutlineNode[]>;
  resourcesByClass: Record<string, SubjectResourceCard[]>;
};

type ThemePalette = {
  surface: string;
  accent: string;
  accentSoft: string;
  text: string;
  ring: string;
};

const DEFAULT_THEME: ThemePalette = {
  surface: "linear-gradient(135deg, rgba(255,248,230,1) 0%, rgba(245,239,255,1) 100%)",
  accent: "#F19F24",
  accentSoft: "#FFF4E2",
  text: "#2B2B2B",
  ring: "rgba(241, 159, 36, 0.28)",
};

const TOKEN_THEMES: Record<string, ThemePalette> = {
  amber: {
    surface: "linear-gradient(135deg, rgba(255,240,203,1) 0%, rgba(255,250,237,1) 100%)",
    accent: "#F19F24",
    accentSoft: "#FFF4E2",
    text: "#3E2A05",
    ring: "rgba(241, 159, 36, 0.32)",
  },
  lime: {
    surface: "linear-gradient(135deg, rgba(232,248,214,1) 0%, rgba(248,252,241,1) 100%)",
    accent: "#108548",
    accentSoft: "#F7F9E2",
    text: "#163A25",
    ring: "rgba(16, 133, 72, 0.24)",
  },
  coral: {
    surface: "linear-gradient(135deg, rgba(255,228,224,1) 0%, rgba(255,245,244,1) 100%)",
    accent: "#F26A5A",
    accentSoft: "#FFEDEA",
    text: "#4A2018",
    ring: "rgba(242, 106, 90, 0.26)",
  },
  ocean: {
    surface: "linear-gradient(135deg, rgba(222,242,255,1) 0%, rgba(240,248,255,1) 100%)",
    accent: "#2A7DE1",
    accentSoft: "#EBF4FF",
    text: "#13325A",
    ring: "rgba(42, 125, 225, 0.22)",
  },
  violet: {
    surface: "linear-gradient(135deg, rgba(238,228,255,1) 0%, rgba(249,245,255,1) 100%)",
    accent: "#7E57C2",
    accentSoft: "#F2ECFF",
    text: "#2F1C52",
    ring: "rgba(126, 87, 194, 0.24)",
  },
};

export function getThemePalette(themeToken?: string | null) {
  if (!themeToken) return DEFAULT_THEME;
  return TOKEN_THEMES[themeToken.toLowerCase()] ?? DEFAULT_THEME;
}

export function getSubjectAbstractImage(seed: string) {
  const hash = seed
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  return SUBJECT_ABSTRACT_IMAGES[hash % SUBJECT_ABSTRACT_IMAGES.length];
}

export function getSubjectHeroImage(seed: string, explicitUrl?: string | null) {
  return explicitUrl || getSubjectAbstractImage(seed);
}

export function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatClassLabel(
  classItem:
    | { class_name: string; stream: string | null }
    | { classLabel: string }
    | null
    | undefined,
) {
  if (!classItem) return "Unassigned";
  if ("classLabel" in classItem) return classItem.classLabel;
  return classItem.stream
    ? `${classItem.class_name} ${classItem.stream}`
    : classItem.class_name;
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SB";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function toDisplayText(value: string | null | undefined, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function toScore(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

export function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => value != null);
  if (!filtered.length) return null;
  const sum = filtered.reduce((total, value) => total + value, 0);
  return Math.round((sum / filtered.length) * 100) / 100;
}

export function truncateWords(text: string | null | undefined, maxWords = 5) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  const words = trimmed.split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value * 100) / 100}%`;
}

export function scoreToGrade(score: number | null | undefined) {
  if (score == null) return "-";
  if (score <= 12) {
    if (score >= 11.5) return "A";
    if (score >= 10.5) return "B+";
    if (score >= 9.5) return "B";
    if (score >= 8.5) return "B-";
    if (score >= 7.5) return "C+";
    if (score >= 6.5) return "C";
    if (score >= 5.5) return "C-";
    if (score >= 4.5) return "D+";
    if (score >= 3.5) return "D";
    if (score >= 2.5) return "D-";
    if (score >= 1.5) return "E";
    return "F";
  }
  if (score >= 80) return "A";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D+";
  if (score >= 40) return "D";
  if (score >= 35) return "D-";
  if (score >= 30) return "E";
  return "F";
}

export function formatEnumLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "-";
  return normalized
    .split(/[-_]/g)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function getRolePriority(role: string | null | undefined) {
  switch (String(role ?? "").toLowerCase()) {
    case "hod":
      return 0;
    case "lead":
      return 1;
    case "teacher":
      return 2;
    case "assistant":
      return 3;
    case "examiner":
      return 4;
    default:
      return 5;
  }
}

export function getAssessmentProgress(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
) {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

export function isYoutubeUrl(url: string | null | undefined) {
  const value = String(url ?? "").toLowerCase();
  return value.includes("youtube.com") || value.includes("youtu.be");
}

export function toYoutubeEmbedUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const value = new URL(url);
    if (value.hostname.includes("youtu.be")) {
      const id = value.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (value.hostname.includes("youtube.com")) {
      const id = value.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

