// =============================================================================
// Student admin DTOs — the JSON contract between /api/students/** and the UI.
// -----------------------------------------------------------------------------
// TYPES + CONSTANTS ONLY (safe to import from hooks and components). Every field
// is plain JSON: BigInt -> number, Date -> ISO string, DATE column -> "YYYY-MM-DD".
// =============================================================================

/** students.status values the old admin page filtered on and toggled. */
export const STUDENT_STATUSES = [
  "active",
  "suspended",
  "pending",
  "removed",
  "graduated",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** The list endpoint never returns more than this many students (the UI filters client-side). */
export const MAX_STUDENTS_PER_LIST = 5000;

export type StudentSchoolOption = { id: string; name: string };

/** A class of the caller's school. `label` is "Grade 7 A" style (class_name + stream). */
export type StudentClassOption = {
  id: string;
  class_name: string;
  stream: string | null;
  label: string;
};

/** One row of GET /api/students. */
export type StudentListItem = {
  id: string;
  user_id: string;
  school_id: string;
  school_name: string;
  admission_no: string;
  first_name: string | null;
  last_name: string;
  /** "First Last", or "Unnamed student" when both are blank. */
  full_name: string;
  class_id: string | null;
  /** "Grade 7 A"; null when the student has no class. */
  class_label: string | null;
  /** "YYYY-MM-DD" or null. */
  date_of_birth: string | null;
  /** Parent contact 1 / 2 as stored on the student. */
  phone: string | null;
  phone2: string | null;
  email: string | null;
  profile_picture: string | null;
  status: string;
  /** students.average_grade as stored (a letter such as "B+"), null when never set. */
  average_grade: string | null;
  /** How many guardians are linked through student_parents. */
  parents_count: number;
  created_at: string;
};

/** Counts per status over ALL students of the school (not only the returned rows). */
export type StudentStatusCounts = { all: number } & Record<StudentStatus, number>;

/** `data` of GET /api/students. */
export type StudentListData = {
  students: StudentListItem[];
  /** Total students of the school. */
  total: number;
  /** true when the school has more than MAX_STUDENTS_PER_LIST students (rows were cut off). */
  truncated: boolean;
  counts: StudentStatusCounts;
  /** Every class of the school (for the class filter), A-Z. */
  classes: StudentClassOption[];
  /** The caller's school only (kept for parity with the old school filter). */
  schools: StudentSchoolOption[];
};

/** `data` of GET /api/students/form-options. */
export type StudentFormOptions = {
  classes: StudentClassOption[];
  schools: StudentSchoolOption[];
  statuses: readonly StudentStatus[];
};

// ---- profile ----------------------------------------------------------------

/** A parent/guardian linked to the student (student_parents -> parent -> users). */
export type StudentGuardian = {
  parent_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  alternate_phone: string | null;
  relationship: string;
  is_primary: boolean;
  /** Extra role note from student_parents.primary_role (e.g. "fees"), when set. */
  primary_role: string | null;
  status: string;
};

/** A subject the student takes (student_subjects, active rows). */
export type StudentSubject = {
  subject_id: number;
  subject_name: string;
  teacher_id: string | null;
  teacher_name: string | null;
};

/** A graded result (grading_reports), newest first. */
export type StudentGrade = {
  subject_id: number;
  subject_name: string;
  term: string;
  grade: string;
  raw_score: number | null;
  normalized_pct: number | null;
  created_at: string | null;
};

/** `data` of GET /api/students/[id]. */
export type StudentProfile = {
  student: {
    id: string;
    user_id: string;
    school_id: string;
    school_name: string;
    admission_no: string;
    first_name: string | null;
    last_name: string;
    full_name: string;
    class_id: string | null;
    class_label: string | null;
    /** The class teacher of the student's class (students.class_teacher_id), when set. */
    class_teacher_id: string | null;
    class_teacher_name: string | null;
    date_of_birth: string | null;
    phone: string | null;
    phone2: string | null;
    /** students.email, falling back to the login account's email (as the old page did). */
    email: string | null;
    location: string | null;
    home_address: string | null;
    emergency_contact: string | null;
    health_status: string | null;
    other_info: string | null;
    activity: string | null;
    profile_picture: string | null;
    status: string;
    created_at: string;
    /** Login account of the student (users row), when readable. */
    account: {
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
    } | null;
  };
  /**
   * Average over ALL graded work: `avg_score` in grade points (A = 12 ... F = 1),
   * `grade` its letter. Both null when the student has no graded work.
   */
  average: { avg_score: number | null; grade: string | null };
  guardians: StudentGuardian[];
  subjects: StudentSubject[];
  /** Latest 10 graded results. */
  recent_grades: StudentGrade[];
  /** Counts from the attendance table (user_type "student"); rate = (present + late) / total, in %. */
  attendance: { present: number; late: number; absent: number; total: number; rate: number };
};

// ---- writes -----------------------------------------------------------------

/**
 * Request body of PATCH /api/students/[id]. Every key is optional; omitted keys are
 * left alone and empty strings on nullable fields clear them. Names, admission
 * number and email are not editable here (they mirror the login account).
 */
export type StudentUpdateInput = {
  status?: StudentStatus;
  /** Class of the caller's school, or null to remove the student from their class. */
  class_id?: string | null;
  phone?: string | null;
  phone2?: string | null;
  /** "YYYY-MM-DD" (not in the future) or null. */
  date_of_birth?: string | null;
  location?: string | null;
  home_address?: string | null;
  emergency_contact?: string | null;
  health_status?: string | null;
  other_info?: string | null;
};

/** `data` of PATCH /api/students/[id]: the refreshed list row. */
export type StudentUpdateResult = { student: StudentListItem };

/** `data` of DELETE /api/students/[id]. */
export type StudentDeleteResult = { id: string };
