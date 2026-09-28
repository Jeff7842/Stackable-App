// =============================================================================
// Portal response types — the CONTRACT between the portal APIs / repositories
// (lib/repositories/*.repo.ts, app/api/{teach,student,parent,admin/overview})
// and the portal hooks + pages (hooks/*, components/portal/**).
// -----------------------------------------------------------------------------
// TYPE-ONLY FILE (no server imports): safe to import from client code.
// These are SUPERSETS of the shapes the routes returned before Wave 2A: every
// field that already existed keeps its name and meaning; new fields are added.
// The repository files re-export the names they own
// (`export type { StudentDashboardData } from "./portal-types"`), so existing
// `import type { ... } from "@/lib/repositories/student.repo"` keeps working.
// All values are JSON-safe: BigInt -> string, Date -> ISO string, Decimal -> number.
// Envelope for every route: { ok: true, data: <type> }.
// The CTO owns this file for Wave 2A; a change means updating BOTH lanes.
// =============================================================================

/** Shared: attendance summary (unchanged from before). `rate` = % present (+late) of total. */
export type AttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  total: number;
  rate: number;
};

/** Shared: one graded result (superset of the old grades item; `createdAt` is new). */
export type GradeRow = {
  subject: string;
  term: string;
  grade: string;
  rawScore: number | null;
  normalizedPct: number | null;
  /** ISO timestamp the report was written; null when unknown. */
  createdAt: string | null;
};

/** Shared: one subject a student takes. */
export type SubjectSummary = {
  id: string;
  name: string;
  teacherName: string | null;
  /** Mean normalizedPct over this student's reports for the subject; null when none. */
  averagePct: number | null;
  /** Most recent grade letter for the subject; null when none. */
  latestGrade: string | null;
};

/** Shared: today's timetable slot (from teacher_timetables). "HH:mm" 24h strings. */
export type LessonSlot = {
  id: string;
  startTime: string;
  endTime: string;
  itemType: string | null;
  title: string | null;
  room: string | null;
  className: string | null;
  subjectName: string | null;
  teacherName: string | null;
};

export type TodaySchedule = {
  /** yyyy-mm-dd in Africa/Nairobi. */
  date: string;
  /** "Monday" ... "Sunday". */
  weekday: string;
  /** Sorted by startTime; empty when none scheduled (UI degrades gracefully). */
  lessons: LessonSlot[];
};

// ── Teacher ───────────────────────────────────────────────────────────────────
// GET /api/teach/portal-data
export type TeacherClassCard = {
  id: string;
  name: string;
  stream: string | null;
  /** Legacy column classes.total_students (kept for compatibility). */
  totalStudents: number | null;
  /** Live count of students.class_id = this class. */
  studentCount: number;
  /** classes.students_present_today; null when not recorded. */
  presentToday: number | null;
};

export type TeacherGradeEntry = {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  subject: string;
  term: string;
  grade: string;
  normalizedPct: number | null;
  createdAt: string | null;
};

export type TeacherAttentionItem = {
  studentId: string;
  name: string;
  className: string | null;
  averagePct: number | null;
  /** low-average = mean normalizedPct < 50; no-grades = has no reports at all. */
  reason: "low-average" | "no-grades";
};

export type TeacherPortalData = {
  teacher: { id: string; name: string; email: string | null; status: string };
  schoolName: string | null;
  classes: TeacherClassCard[];
  subjects: Array<{ id: string; subjectName: string }>;
  studentCount: number;
  today: TodaySchedule;
  /** Last <= 6 reports written by this teacher, newest first. */
  recentGrading: TeacherGradeEntry[];
  /** <= 6 assigned students needing attention (lowest averages first). */
  attention: TeacherAttentionItem[];
};

// GET /api/teach/students   -> { students: TeacherStudent[]; total: number }
export type TeacherStudent = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  status: string;
  classId: string | null;
  className: string | null;
  profilePicture: string | null;
  averageGrade: string | null;
  averagePct: number | null;
  /** null when no attendance rows exist for the student. */
  attendanceRate: number | null;
};

// GET /api/teach/students/[studentId]  (only for students assigned to the teacher; else 404)
export type TeacherStudentProfile = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
    status: string;
    classId: string | null;
    className: string | null;
    profilePicture: string | null;
    averageGrade: string | null;
    averagePct: number | null;
    dateOfBirth: string | null;
    email: string | null;
  };
  grades: GradeRow[];
  attendance: AttendanceSummary;
};

// ── Student ───────────────────────────────────────────────────────────────────
// GET /api/student/dashboard
export type StudentDashboardData = {
  student: {
    id: string;
    firstName: string | null;
    lastName: string;
    admissionNo: string;
    className: string | null;
    averageGrade: string | null;
    status: string;
    profilePicture: string | null;
    classTeacherName: string | null;
  };
  subjectCount: number;
  grades: GradeRow[];
  attendance: AttendanceSummary;
  /** Active subjects with teacher + running average. */
  subjects: SubjectSummary[];
  /** The student's class timetable for today (the "upcoming" rail). */
  today: TodaySchedule;
};

// GET /api/student/grades  -> GradeRow[]  (unchanged envelope: { ok, data: GradeRow[] })
export type StudentGradesData = GradeRow[];

// ── Parent ────────────────────────────────────────────────────────────────────
// GET /api/parent/children  -> ChildCard[]
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
  subjectCount: number;
  averagePct: number | null;
  /** null when the child has no attendance rows. */
  attendanceRate: number | null;
  latestGrade: {
    subject: string;
    term: string;
    grade: string;
    normalizedPct: number | null;
  } | null;
};

// GET /api/parent/children/[studentId]  (403 when not the parent's child - unchanged)
export type ChildOverview = {
  student: {
    id: string;
    firstName: string | null;
    lastName: string;
    admissionNo: string;
    className: string | null;
    profilePicture: string | null;
    status: string;
    averageGrade: string | null;
    averagePct: number | null;
    dateOfBirth: string | null;
    classTeacherName: string | null;
  };
  grades: GradeRow[];
  attendance: AttendanceSummary;
  subjects: SubjectSummary[];
};

// ── Admin overview ────────────────────────────────────────────────────────────
// GET /api/admin/overview  (roles admin | manager | super-admin; scoped to ctx.schoolId)
export type AdminAttendanceDay = {
  /** yyyy-mm-dd */
  date: string;
  present: number;
  total: number;
  /** 0-100, one decimal. */
  rate: number;
};

export type AdminClassPerformance = {
  classId: string;
  className: string;
  studentCount: number;
  presentToday: number | null;
  /** classes.class_performance or mean of class_subject_performance.average_score; null when none. */
  averageScore: number | null;
  averageGrade: string | null;
};

export type AdminRecentGrade = {
  id: string;
  studentName: string;
  className: string | null;
  subject: string;
  term: string;
  grade: string;
  normalizedPct: number | null;
  createdAt: string | null;
};

export type AdminActivityItem = {
  id: string;
  kind: "grade" | "student" | "teacher";
  title: string;
  detail: string | null;
  /** ISO timestamp */
  at: string;
};

export type AdminOverviewData = {
  generatedAt: string;
  school: { id: string; name: string };
  totals: {
    students: number;
    teachers: number;
    classes: number;
    subjects: number;
    parents: number;
  };
  attendanceToday: {
    present: number;
    late: number;
    absent: number;
    total: number;
    /** null when nothing recorded today. */
    rate: number | null;
    /** Which table the numbers came from. */
    source: "attendance" | "class_attendance" | "none";
  };
  /** Up to the last 7 recorded days, oldest first. */
  attendanceTrend: AdminAttendanceDay[];
  classPerformance: AdminClassPerformance[];
  recentGrades: AdminRecentGrade[];
  /** Merged feed (grades, new students, new teachers), newest first, <= 8. */
  recentActivity: AdminActivityItem[];
};
