// =============================================================================
// TeacherAdminStore — the data-access contract the teacher admin service needs.
// -----------------------------------------------------------------------------
// The one real implementation is lib/repositories/teacher-admin.repo.ts (Prisma +
// PostgreSQL). The service (teacher-admin.service.ts) holds every business rule and
// only talks to this interface, so the rules can be checked with an in-memory fake.
//
// Every method that takes a schoolId scopes by it: an id from another school is
// simply "not found" (null / false), never read or written.
// =============================================================================

import type {
  ClassOption,
  SubjectOption,
  TeacherAttendanceData,
  TeacherEditData,
  TeacherFormOptions,
  TeacherListItem,
  TeacherProfileData,
  TeacherTimetableData,
  TimetableWriteRow,
} from "@/lib/dto/teachers";

/** A class row as the rules need it (no label). */
export type ClassRef = Pick<ClassOption, "id" | "school_id" | "class_name" | "stream" | "class_teacher_id">;

/** The teacher columns the service reads before deciding what to write. */
export type TeacherRow = {
  id: string;
  school_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  subject_id: number | null;
  profile_photo: string | null;
  status: string;
  class_teacher: boolean | null;
};

/** Column changes for the teachers row itself. Only keys that are present are written. */
export type TeacherFieldChanges = {
  name?: string;
  email?: string;
  phone?: string | null;
  admission_number?: string;
  status?: string;
  class_teacher?: boolean;
  profile_photo?: string | null;
  /** Primary subject (teachers.subject_id). null clears it. */
  subject_id?: number | null;
};

/** Everything one PATCH may change, applied together or not at all. */
export type TeacherWritePlan = {
  schoolId: string;
  teacherId: string;
  fields: TeacherFieldChanges;
  /**
   * undefined = leave class ownership alone.
   * null = release every class this teacher leads.
   * an id = release every class they lead, then lead ONLY that one (rejected with a
   *         409 ApiError when another teacher already leads it).
   */
  classOwnership?: string | null;
  /** undefined = leave alone; else the complete list of subject ids (first = primary). */
  subjectIds?: number[];
  /** undefined = leave alone; else the complete new timetable. */
  timetable?: TimetableWriteRow[];
};

/** Everything needed to create one teacher (the service has already validated it all). */
export type TeacherCreatePlan = {
  /** Generated up front so the photo path can contain it. */
  id: string;
  schoolId: string;
  name: string;
  email: string;
  phone: string;
  admissionNumber: string;
  /** App URL of the already-uploaded photo. */
  profilePhoto: string;
  subjectId: number;
  classId: string;
};

/** What the create flow needs to know before it writes. Missing pieces are null. */
export type TeacherCreateContext = {
  school: { id: string; name: string } | null;
  /** The chosen class, only when it belongs to the caller's school. */
  klass: ClassRef | null;
  subject: SubjectOption | null;
};

export interface TeacherAdminStore {
  /** Every teacher of the school (max 5000), newest first: the GET /api/teachers rows. */
  listTeachers(schoolId: string): Promise<TeacherListItem[]>;
  /** The GET /api/teachers/[id] payload, or null. */
  getProfile(schoolId: string, teacherId: string): Promise<TeacherProfileData | null>;
  /** The GET /api/teachers/form-options payload (only the caller's school). */
  getFormOptions(schoolId: string): Promise<TeacherFormOptions>;
  /** true when the teacher exists in this school (guards the photo route). */
  teacherExists(schoolId: string, teacherId: string): Promise<boolean>;
  /** School, class (of this school) and subject rows the create flow validates against. */
  findCreateContext(schoolId: string, classId: string, subjectId: number): Promise<TeacherCreateContext>;
  /**
   * Create the teacher, claim the class as its class teacher and add the subject row,
   * all in one transaction. Throws a 409 ApiError (CLASS_TEACHER_TAKEN) when the class
   * already has a class teacher; nothing is left behind on any failure.
   */
  createTeacher(plan: TeacherCreatePlan): Promise<void>;

  /** One teacher of the school, or null. */
  getTeacherRow(schoolId: string, teacherId: string): Promise<TeacherRow | null>;
  /** The list-row shape (GET /api/teachers) for one teacher, or null. */
  getTeacherListItem(schoolId: string, teacherId: string): Promise<TeacherListItem | null>;
  getEditData(schoolId: string, teacherId: string): Promise<TeacherEditData | null>;
  getTimetable(schoolId: string, teacherId: string): Promise<TeacherTimetableData | null>;
  getAttendance(schoolId: string, teacherId: string, limit: number): Promise<TeacherAttendanceData | null>;

  /** true for each unique field that another teacher (any school: both columns are globally unique) already uses. */
  findIdentityConflicts(args: {
    email?: string;
    admissionNumber?: string;
    /** Skip this teacher (the one being edited). Omit when creating. */
    excludeTeacherId?: string;
  }): Promise<{ email: boolean; admission_number: boolean }>;
  /** Every class of the school (used to verify ids and the class-teacher rule). */
  listClasses(schoolId: string): Promise<ClassRef[]>;
  /** The subject catalogue rows for these ids (unknown ids are simply missing from the result). */
  findSubjects(ids: number[]): Promise<SubjectOption[]>;

  /** Apply the whole plan atomically; rolls back everything on failure. */
  applyUpdate(plan: TeacherWritePlan): Promise<void>;
  /** Replace the timetable atomically. */
  replaceTimetable(schoolId: string, teacherId: string, slots: TimetableWriteRow[]): Promise<void>;

  /** How many grading_reports the teacher wrote (they are deleted with the teacher). */
  countGradingReports(teacherId: string): Promise<number>;
  /** Delete the teacher (database rules clear their class-teacher / timetable / subject links). false when not found. */
  deleteTeacher(schoolId: string, teacherId: string): Promise<boolean>;
}
