// =============================================================================
// Student admin mappers — raw database rows -> DTOs, shared by BOTH backends.
// -----------------------------------------------------------------------------
// The Prisma repository fetches Date / BigInt / Decimal typed
// rows (Date vs string, BigInt vs number) and hand them to these functions, so the
// JSON that reaches the browser is identical whichever backend served it.
// Pure functions: no database, no HTTP (checked in lib/validation/students.check.ts).
// =============================================================================

import {
  classLabelOrNull,
  compareClasses,
  studentFullName,
  toDateOnly,
  toIso,
  toNumber,
} from "@/lib/admin-normalize";
import { scoreToGrade } from "@/lib/teachers";
import {
  STUDENT_STATUSES,
  type StudentClassOption,
  type StudentGrade,
  type StudentGuardian,
  type StudentListItem,
  type StudentProfile,
  type StudentStatusCounts,
  type StudentSubject,
} from "@/lib/dto/students";

type DateLike = Date | string | null | undefined;
type ClassNameParts = { class_name: string; stream: string | null };

/** The students columns the list row needs (dates as Date or string). */
export type StudentListRaw = {
  id: string;
  user_id: string;
  school_id: string;
  school_name: string;
  admission_no: string;
  first_name: string | null;
  last_name: string;
  class_id: string | null;
  date_of_birth: DateLike;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  profile_picture: string | null;
  status: string;
  average_grade: string | null;
  created_at: Date | string;
};

/** One list row. `classItem` is the student's class (for the label), `parentsCount` the linked guardians. */
export function toStudentListItem(
  row: StudentListRaw,
  classItem: ClassNameParts | null | undefined,
  parentsCount: number,
): StudentListItem {
  return {
    id: row.id,
    user_id: row.user_id,
    school_id: row.school_id,
    school_name: row.school_name,
    admission_no: row.admission_no,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: studentFullName(row.first_name, row.last_name),
    class_id: row.class_id,
    class_label: classLabelOrNull(classItem),
    date_of_birth: toDateOnly(row.date_of_birth),
    phone: row.phone,
    phone2: row.phone2,
    email: row.email,
    profile_picture: row.profile_picture,
    status: row.status,
    average_grade: row.average_grade,
    parents_count: parentsCount,
    created_at: toIso(row.created_at) ?? "",
  };
}

/** Class filter options, A-Z with numbers compared numerically. */
export function toStudentClassOptions(rows: Array<ClassNameParts & { id: string }>): StudentClassOption[] {
  return [...rows].sort(compareClasses).map((row) => ({
    id: row.id,
    class_name: row.class_name,
    stream: row.stream,
    label: classLabelOrNull(row) ?? row.class_name,
  }));
}

/** { all, active, suspended, ... } from grouped status counts; unknown statuses only count toward `all`. */
export function buildStatusCounts(groups: ReadonlyArray<{ status: string; count: number }>): StudentStatusCounts {
  const counts = { all: 0 } as StudentStatusCounts;
  for (const status of STUDENT_STATUSES) counts[status] = 0;
  for (const group of groups) {
    counts.all += group.count;
    if ((STUDENT_STATUSES as readonly string[]).includes(group.status)) {
      counts[group.status as keyof StudentStatusCounts] += group.count;
    }
  }
  return counts;
}

/** { present, late, absent, total, rate } from grouped attendance counts; rate counts late as attended. */
export function summariseAttendance(groups: ReadonlyArray<{ status: string; count: number }>) {
  const counts = { present: 0, late: 0, absent: 0 };
  for (const group of groups) {
    if (group.status === "present") counts.present += group.count;
    else if (group.status === "late") counts.late += group.count;
    else if (group.status === "absent") counts.absent += group.count;
  }
  const total = counts.present + counts.late + counts.absent;
  const rate = total === 0 ? 0 : Math.round(((counts.present + counts.late) / total) * 100);
  return { ...counts, total, rate };
}

/** Raw pieces of one profile, fetched however the backend likes. */
export type StudentProfileRaw = {
  student: StudentListRaw & {
    class_teacher_id: string | null;
    location: string | null;
    home_address: string | null;
    emergency_contact: string | null;
    health_status: string | null;
    other_info: string | null;
    activity: string | null;
  };
  classItem: ClassNameParts | null;
  classTeacher: { id: string; name: string } | null;
  /** The login account (users row); phone may be a BigInt/number/string. */
  account: { first_name: string; last_name: string; email: string | null; phone: unknown } | null;
  guardians: Array<{
    parent_id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: unknown;
    alternate_phone: string | null;
    relationship: string;
    is_primary: boolean;
    primary_role: string | null;
    status: string;
  }>;
  subjects: Array<{ subject_id: unknown; subject_name: string; teacher_id: string | null; teacher_name: string | null }>;
  recentGrades: Array<{
    subject_id: unknown;
    subject_name: string;
    term: string;
    grade: string;
    raw_score: unknown;
    normalized_pct: unknown;
    created_at: DateLike;
  }>;
  avgScore: number | null;
  attendance: ReadonlyArray<{ status: string; count: number }>;
};

const asText = (value: unknown): string | null => (value === null || value === undefined ? null : String(value));

/** Assemble the profile DTO. Sorting (guardians primary-first, subjects A-Z) is applied here too. */
export function toStudentProfile(raw: StudentProfileRaw): StudentProfile {
  const student = raw.student;

  const guardians: StudentGuardian[] = raw.guardians
    .map((guardian) => ({
      parent_id: guardian.parent_id,
      name: `${guardian.first_name} ${guardian.last_name}`.trim(),
      email: guardian.email,
      phone: asText(guardian.phone),
      alternate_phone: guardian.alternate_phone,
      relationship: guardian.relationship,
      is_primary: guardian.is_primary,
      primary_role: guardian.primary_role,
      status: guardian.status,
    }))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name));

  const subjects: StudentSubject[] = raw.subjects
    .map((subject) => ({
      subject_id: Number(subject.subject_id),
      subject_name: subject.subject_name,
      teacher_id: subject.teacher_id,
      teacher_name: subject.teacher_name,
    }))
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  const recentGrades: StudentGrade[] = raw.recentGrades.map((grade) => ({
    subject_id: Number(grade.subject_id),
    subject_name: grade.subject_name,
    term: grade.term,
    grade: grade.grade,
    raw_score: toNumber(grade.raw_score),
    normalized_pct: toNumber(grade.normalized_pct),
    created_at: toIso(grade.created_at),
  }));

  return {
    student: {
      id: student.id,
      user_id: student.user_id,
      school_id: student.school_id,
      school_name: student.school_name,
      admission_no: student.admission_no,
      first_name: student.first_name,
      last_name: student.last_name,
      full_name: studentFullName(student.first_name, student.last_name),
      class_id: student.class_id,
      class_label: classLabelOrNull(raw.classItem),
      class_teacher_id: raw.classTeacher?.id ?? student.class_teacher_id ?? null,
      class_teacher_name: raw.classTeacher?.name ?? null,
      date_of_birth: toDateOnly(student.date_of_birth),
      phone: student.phone,
      phone2: student.phone2,
      // The old page showed students.email and fell back to the login account's email.
      email: student.email ?? raw.account?.email ?? null,
      location: student.location,
      home_address: student.home_address,
      emergency_contact: student.emergency_contact,
      health_status: student.health_status,
      other_info: student.other_info,
      activity: student.activity,
      profile_picture: student.profile_picture,
      status: student.status,
      created_at: toIso(student.created_at) ?? "",
      account: raw.account
        ? {
            first_name: raw.account.first_name,
            last_name: raw.account.last_name,
            email: raw.account.email,
            phone: asText(raw.account.phone),
          }
        : null,
    },
    average: {
      avg_score: raw.avgScore,
      grade: raw.avgScore === null ? null : scoreToGrade(raw.avgScore),
    },
    guardians,
    subjects,
    recent_grades: recentGrades,
    attendance: summariseAttendance(raw.attendance),
  };
}
