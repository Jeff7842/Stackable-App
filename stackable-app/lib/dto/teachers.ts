// =============================================================================
// Teacher admin DTOs — the JSON contract between /api/teachers/** and the UI.
// -----------------------------------------------------------------------------
// TYPES + CONSTANTS ONLY. No server imports, so hooks and components can import
// this file freely. Every response type here is plain JSON: BigInt -> number,
// Date -> ISO string, time-of-day -> "HH:MM", date -> "YYYY-MM-DD". That keeps a
// cache HIT (which JSON-serialises) identical to a cache MISS.
// =============================================================================

/** Teacher lifecycle states (teachers.status). The old edit page offered exactly these five. */
export const TEACHER_STATUSES = [
  "active",
  "suspended",
  "on_leave",
  "retired",
  "terminated",
] as const;
export type TeacherStatus = (typeof TEACHER_STATUSES)[number];

/** Days a timetable slot can sit on (teacher_timetables.day_of_week, always lower-case). */
export const TIMETABLE_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];

/** Kinds of timetable block (teacher_timetables.item_type). */
export const TIMETABLE_ITEM_TYPES = ["class", "event", "duty", "task"] as const;
export type TimetableItemType = (typeof TIMETABLE_ITEM_TYPES)[number];

/** Hourly row starts of the weekly grid on the old edit page (07:00 .. 17:00). Slots may start at any time. */
export const TIMETABLE_SLOT_STARTS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

/** Upper bound on timetable rows per teacher (guards the request size). */
export const MAX_TIMETABLE_SLOTS = 100;
/** Upper bound on subjects assigned to one teacher. */
export const MAX_TEACHER_SUBJECTS = 40;
/** Profile photo rules (same as POST /api/teachers). */
export const TEACHER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// ---- shared option shapes ---------------------------------------------------

export type SchoolOption = { id: string; name: string };
export type SubjectOption = { id: number; subject_name: string };

/** A class of the caller's school. `label` is "Grade 7 A" style (class_name + stream). */
export type ClassOption = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
  /** The teacher who is class teacher of this class, if any (a class has at most one). */
  class_teacher_id: string | null;
  label: string;
};

// ---- existing endpoints (shapes unchanged) ----------------------------------

/** One row of GET /api/teachers. */
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

/** `data` of GET /api/teachers/form-options (class rows carry class_teacher_id, no label). */
export type TeacherFormOptions = {
  schools: SchoolOption[];
  classes: Array<{
    id: string;
    school_id: string;
    class_name: string;
    stream: string | null;
    class_teacher_id: string | null;
  }>;
  subjects: SubjectOption[];
};

/** A pupil row of GET /api/teachers/[id] (the pupils of the teacher's classes). */
export type TeacherPupil = {
  id: string;
  full_name: string;
  admission_no: string;
  class_id: string | null;
  class_name: string;
  phone: string | null;
  phone2: string | null;
  status: string;
  profile_picture: string | null;
  /** Average grade points (A = 12 ... F = 1). null when the pupil has no graded work. */
  avg_score: number | null;
  /** Letter for avg_score, "-" when there is none. */
  grade: string;
};

/** `data` of GET /api/teachers/[id]. */
export type TeacherProfileData = {
  teacher: {
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
    attendance_percentage: number | string | null;
    class_teacher: boolean | null;
    school_name: string | null;
    subjects: SubjectOption[];
    classes: Array<{ id: string; label: string }>;
    students_count: number;
  };
  students: TeacherPupil[];
};

/** `data` of POST /api/teachers (multipart create). */
export type TeacherCreateResult = {
  id: string;
  teacher: {
    id: string;
    name: string;
    email: string;
    phone: string;
    admission_number: string;
    school_id: string;
    school_name: string;
    subject_id: number;
    subject_name: string;
    profile_photo: string;
    class_teacher: boolean;
    class_labels: string[];
    status: string;
  };
};

/** Fields the create form posts (multipart). `photo` is required by the server. */
export type TeacherCreateInput = {
  name: string;
  email: string;
  phone: string;
  admission_number: string;
  class_id: string;
  subject_id: number;
  photo: File;
};

// ---- timetable --------------------------------------------------------------

/** A stored timetable slot (teacher_timetables row, times as "HH:MM"). */
export type TimetableSlot = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: number | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  item_type: TimetableItemType;
  /** Set for event/duty/task blocks, null for class blocks. */
  title: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * A slot as sent by the UI. `id` (and any other unknown key) is ignored: the
 * server replaces the whole timetable, so every saved slot gets a fresh id.
 * class_id / subject_id only apply to item_type "class"; for other types the
 * server stores null (same as the old edit page).
 */
export type TimetableSlotInput = {
  id?: string;
  class_id?: string | null;
  subject_id?: number | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  item_type?: TimetableItemType;
  title?: string | null;
  notes?: string | null;
};

/** A validated, normalised slot ready to be written (output of the timetable schema). */
export type TimetableWriteRow = {
  class_id: string | null;
  subject_id: number | null;
  day_of_week: TimetableDay;
  start_time: string;
  end_time: string;
  room: string | null;
  item_type: TimetableItemType;
  title: string | null;
  notes: string | null;
};

/** Two slots of the same teacher that overlap on one day. Reported, never blocking. */
export type TimetableConflict = {
  day_of_week: string;
  /** Index into the submitted `slots` / `timetable` array. */
  first_index: number;
  second_index: number;
  message: string;
};

// ---- edit page --------------------------------------------------------------

/** `data` of GET /api/teachers/[id]/edit-data: everything the edit page needs in one call. */
export type TeacherEditData = {
  teacher: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    admission_number: string;
    school_id: string;
    school_name: string | null;
    profile_photo: string | null;
    status: string;
    class_teacher: boolean;
    subject_id: number | null;
    created_at: string | null;
    days_present: number | null;
    total_school_days: number | null;
    attendance_percentage: number | null;
  };
  /** The whole (global) subject catalogue, A-Z. */
  subjects: SubjectOption[];
  /** Classes of the teacher's school, A-Z. */
  classes: ClassOption[];
  /** Subjects the teacher teaches. The primary subject (teachers.subject_id) is FIRST. */
  assigned_subject_ids: number[];
  /** Class this teacher is class teacher of, or null. */
  class_teacher_class_id: string | null;
  /** Classes in the timetable plus the class-teacher class (what the old page called assignedClassIds). */
  assigned_class_ids: string[];
  /** Weekly timetable, sorted Monday -> Sunday then by start time. */
  timetable: TimetableSlot[];
};

/** Request body of PATCH /api/teachers/[id]. Every key is optional; omitted keys are left alone. */
export type TeacherUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  admission_number?: string;
  status?: TeacherStatus;
  class_teacher?: boolean;
  /**
   * Class this teacher leads. A class id makes them class teacher of ONLY that class
   * (any other class they led is released). null releases every class. 409 when the
   * class already has a different class teacher.
   */
  class_teacher_class_id?: string | null;
  /** Replaces the teacher's subjects; the FIRST id becomes the primary subject (teachers.subject_id). */
  subject_ids?: number[];
  /** Replaces the whole weekly timetable (atomic). */
  timetable?: TimetableSlotInput[];
  /** Drop the profile photo (ignored when a new photo is uploaded in the same request). */
  remove_photo?: boolean;
};

/** `data` of PATCH /api/teachers/[id]. */
export type TeacherUpdateResult = {
  id: string;
  teacher: TeacherListItem;
  /** Overlaps inside the saved timetable (empty when none / timetable not sent). Informational only. */
  timetable_conflicts: TimetableConflict[];
};

/** `data` of DELETE /api/teachers/[id]. */
export type TeacherDeleteResult = { id: string };

// ---- timetable page ---------------------------------------------------------

/** `data` of GET /api/teachers/[id]/timetable. */
export type TeacherTimetableData = {
  teacher: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    admission_number: string;
    profile_photo: string | null;
    status: string;
    class_teacher: boolean;
  };
  slots: TimetableSlot[];
  /** Classes of the teacher's school (to label class_id). */
  classes: ClassOption[];
  /** The subject catalogue (to label subject_id). */
  subjects: SubjectOption[];
};

/** Request body of PUT /api/teachers/[id]/timetable (replaces the whole timetable). */
export type TeacherTimetableSaveInput = { slots: TimetableSlotInput[] };

/** `data` of PUT /api/teachers/[id]/timetable. */
export type TeacherTimetableSaveResult = {
  slots: TimetableSlot[];
  conflicts: TimetableConflict[];
};

// ---- attendance page --------------------------------------------------------

/** One clock-in record of the teacher (attendance table, user_type "teacher"). */
export type TeacherAttendanceRecord = {
  id: string;
  reference_code: string;
  clock_in: string;
  clock_out: string | null;
  /** present | late | absent */
  status: string;
  remarks: string | null;
  created_at: string;
};

/** `data` of GET /api/teachers/[id]/attendance. */
export type TeacherAttendanceData = {
  teacher: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    admission_number: string;
    profile_photo: string | null;
    status: string;
    class_teacher: boolean;
    subject_id: number | null;
    subject_name: string | null;
    days_present: number | null;
    total_school_days: number | null;
    attendance_percentage: number | null;
  };
  /** Counts over ALL of the teacher's records (not just the returned page). */
  summary: { total: number; present: number; late: number; absent: number };
  /** Newest first, at most `limit` (default 200, max 500). */
  records: TeacherAttendanceRecord[];
  /** true when the teacher has more records than were returned. */
  truncated: boolean;
};
