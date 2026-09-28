// =============================================================================
// Teacher admin mappers — raw database rows -> DTOs, shared by BOTH backends.
// -----------------------------------------------------------------------------
// The Prisma repository fetches Date / BigInt / Decimal typed rows
// (Date vs string, BigInt vs number) and hand them to these pure functions, so the
// JSON that reaches the browser is identical whichever backend served it.
// Checked in lib/validation/teachers.check.ts.
// =============================================================================

import { classLabelOrNull, compareClasses, toIso, toNumber } from "@/lib/admin-normalize";
import { formatClassLabel } from "@/lib/teachers";
import { normalizeTime, sortTimetable } from "@/lib/timetable";
import {
  TIMETABLE_ITEM_TYPES,
  type ClassOption,
  type SubjectOption,
  type TeacherAttendanceData,
  type TeacherAttendanceRecord,
  type TeacherEditData,
  type TeacherListItem,
  type TeacherTimetableData,
  type TimetableItemType,
  type TimetableSlot,
} from "@/lib/dto/teachers";

type DateLike = Date | string | null | undefined;

/** The teachers columns every DTO here is built from. */
export type TeacherRaw = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  subject_id: unknown;
  school_id: string;
  profile_photo: string | null;
  status: string;
  created_at: DateLike;
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: unknown;
  class_teacher: boolean | null;
};

export type ClassRaw = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
  class_teacher_id: string | null;
};

export type TimetableRaw = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: unknown;
  day_of_week: string;
  start_time: unknown;
  end_time: unknown;
  room: string | null;
  item_type: string | null;
  title: string | null;
  notes: string | null;
  created_at: DateLike;
};

export type SubjectRaw = { id: unknown; subject_name: string };

export const toSubjectOptions = (rows: SubjectRaw[]): SubjectOption[] =>
  rows
    .map((row) => ({ id: Number(row.id), subject_name: row.subject_name }))
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

export function toClassOption(row: ClassRaw): ClassOption {
  return {
    id: row.id,
    school_id: row.school_id,
    class_name: row.class_name,
    stream: row.stream,
    class_teacher_id: row.class_teacher_id,
    label: classLabelOrNull(row) ?? row.class_name,
  };
}

export const toClassOptions = (rows: ClassRaw[]): ClassOption[] => [...rows].sort(compareClasses).map(toClassOption);

const teacherNumber = (value: unknown): number | null => toNumber(value);

/**
 * One row of GET /api/teachers for a single teacher (same shape as listTeachersWithMeta).
 * Class labels = classes the teacher leads first, then the classes in their timetable,
 * each class once ("Unassigned" when a class id is unknown, like the list does).
 */
export function toTeacherListItem(
  teacher: TeacherRaw,
  context: {
    schoolName: string | null;
    subjectName: string | null;
    ownedClasses: ClassRaw[];
    timetableClassIds: Array<string | null>;
    classesById: Map<string, { class_name: string; stream: string | null }>;
  },
): TeacherListItem {
  const classIds = new Set<string>(context.ownedClasses.map((item) => item.id));
  for (const classId of context.timetableClassIds) if (classId) classIds.add(classId);

  return {
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    admission_number: teacher.admission_number,
    subject_id: teacherNumber(teacher.subject_id),
    school_id: teacher.school_id,
    profile_photo: teacher.profile_photo,
    status: teacher.status,
    created_at: toIso(teacher.created_at),
    days_present: teacher.days_present,
    total_school_days: teacher.total_school_days,
    attendance_percentage: teacherNumber(teacher.attendance_percentage),
    class_teacher: teacher.class_teacher,
    school_name: context.schoolName,
    subject_name: context.subjectName,
    class_labels: Array.from(classIds).map((id) => formatClassLabel(context.classesById.get(id))),
  };
}

const isItemType = (value: unknown): value is TimetableItemType =>
  (TIMETABLE_ITEM_TYPES as readonly string[]).includes(String(value));

/** A stored timetable row -> slot DTO (times as "HH:MM", missing item_type = "class"). */
export function toTimetableSlot(row: TimetableRaw): TimetableSlot {
  return {
    id: row.id,
    teacher_id: row.teacher_id,
    class_id: row.class_id,
    subject_id: teacherNumber(row.subject_id),
    day_of_week: String(row.day_of_week ?? "").toLowerCase(),
    start_time: normalizeTime(row.start_time) ?? "00:00",
    end_time: normalizeTime(row.end_time) ?? "00:00",
    room: row.room,
    item_type: isItemType(row.item_type) ? row.item_type : "class",
    title: row.title,
    notes: row.notes,
    created_at: toIso(row.created_at),
  };
}

export const toTimetableSlots = (rows: TimetableRaw[]): TimetableSlot[] => sortTimetable(rows.map(toTimetableSlot));

/** Everything the edit page needs, from already-fetched rows. */
export function toEditData(raw: {
  teacher: TeacherRaw;
  schoolName: string | null;
  subjects: SubjectRaw[];
  classes: ClassRaw[];
  /** teacher_subjects subject ids, best-first (primary flag, then oldest). */
  bridgeSubjectIds: unknown[];
  timetable: TimetableRaw[];
}): TeacherEditData {
  const { teacher } = raw;
  const timetable = toTimetableSlots(raw.timetable);
  const classes = toClassOptions(raw.classes);

  // Primary subject first so re-saving the form keeps the same primary subject.
  const primary = teacherNumber(teacher.subject_id);
  const assignedSubjectIds = Array.from(
    new Set([...(primary === null ? [] : [primary]), ...raw.bridgeSubjectIds.map(Number)]),
  ).filter((id) => Number.isFinite(id) && id > 0);

  const classTeacherClass = classes.find((item) => item.class_teacher_id === teacher.id) ?? null;
  const assignedClassIds = Array.from(
    new Set([
      ...timetable.map((slot) => slot.class_id).filter((id): id is string => Boolean(id)),
      ...(classTeacherClass ? [classTeacherClass.id] : []),
    ]),
  );

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      admission_number: teacher.admission_number,
      school_id: teacher.school_id,
      school_name: raw.schoolName,
      profile_photo: teacher.profile_photo,
      status: teacher.status,
      class_teacher: Boolean(teacher.class_teacher),
      subject_id: primary,
      created_at: toIso(teacher.created_at),
      days_present: teacher.days_present,
      total_school_days: teacher.total_school_days,
      attendance_percentage: teacherNumber(teacher.attendance_percentage),
    },
    subjects: toSubjectOptions(raw.subjects),
    classes,
    assigned_subject_ids: assignedSubjectIds,
    class_teacher_class_id: classTeacherClass?.id ?? null,
    assigned_class_ids: assignedClassIds,
    timetable,
  };
}

/** The timetable page payload. */
export function toTimetableData(raw: {
  teacher: TeacherRaw;
  timetable: TimetableRaw[];
  classes: ClassRaw[];
  subjects: SubjectRaw[];
}): TeacherTimetableData {
  const { teacher } = raw;
  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      admission_number: teacher.admission_number,
      profile_photo: teacher.profile_photo,
      status: teacher.status,
      class_teacher: Boolean(teacher.class_teacher),
    },
    slots: toTimetableSlots(raw.timetable),
    classes: toClassOptions(raw.classes),
    subjects: toSubjectOptions(raw.subjects),
  };
}

/** The attendance page payload. `records` newest first; `groups` are counts over ALL records. */
export function toAttendanceData(raw: {
  teacher: TeacherRaw;
  subjectName: string | null;
  groups: ReadonlyArray<{ status: string; count: number }>;
  records: Array<{
    id: string;
    reference_code: string;
    clock_in: Date | string;
    clock_out: DateLike;
    status: string;
    remarks: string | null;
    created_at: Date | string;
  }>;
  limit: number;
}): TeacherAttendanceData {
  const summary = { total: 0, present: 0, late: 0, absent: 0 };
  for (const group of raw.groups) {
    summary.total += group.count;
    if (group.status === "present") summary.present += group.count;
    else if (group.status === "late") summary.late += group.count;
    else if (group.status === "absent") summary.absent += group.count;
  }

  const records: TeacherAttendanceRecord[] = raw.records.slice(0, raw.limit).map((record) => ({
    id: record.id,
    reference_code: record.reference_code,
    clock_in: toIso(record.clock_in) ?? "",
    clock_out: toIso(record.clock_out),
    status: record.status,
    remarks: record.remarks,
    created_at: toIso(record.created_at) ?? "",
  }));

  const { teacher } = raw;
  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      admission_number: teacher.admission_number,
      profile_photo: teacher.profile_photo,
      status: teacher.status,
      class_teacher: Boolean(teacher.class_teacher),
      subject_id: teacherNumber(teacher.subject_id),
      subject_name: raw.subjectName,
      days_present: teacher.days_present,
      total_school_days: teacher.total_school_days,
      attendance_percentage: teacherNumber(teacher.attendance_percentage),
    },
    summary,
    records,
    truncated: summary.total > records.length,
  };
}

/**
 * Work out how to move a teacher's subject rows to a new list WITHOUT deleting rows
 * that stay: the row also carries assignment_role and school_subject_id (set by the
 * subjects module), which a delete-and-recreate would wipe.
 *
 * @param existing current teacher_subjects rows
 * @param nextIds the complete new list; the first id is the primary subject
 * @returns ids to delete, ids to insert, and the id that must be flagged primary
 */
export function diffTeacherSubjects(
  existing: ReadonlyArray<{ subject_id: number }>,
  nextIds: readonly number[],
): { toDelete: number[]; toInsert: number[]; primary: number | null } {
  const current = new Set(existing.map((row) => Number(row.subject_id)));
  const wanted = new Set(nextIds);
  return {
    toDelete: Array.from(current).filter((id) => !wanted.has(id)),
    toInsert: nextIds.filter((id) => !current.has(id)),
    primary: nextIds[0] ?? null,
  };
}
