// Shared sample data for the demo: one fictional school, built the same way on every seed.
import { scoreToGrade } from "@/lib/subjects";
import type { StudentListItem } from "@/lib/dto/students";
import type { TeacherListItem } from "@/lib/dto/teachers";
import type { AttendanceSummary, GradeRow, LessonSlot, SubjectSummary, TodaySchedule } from "@/lib/repositories/portal-types";

export const SCHOOL = { id: "demo-school", code: "DEMO", name: "Stackable Demo Academy" };
export const TERM = "Term 2 2026";
export const CREATED_AT = "2026-01-12T08:00:00.000Z";

const CLASS_DEFS: Array<[string, string, string]> = [
  ["cls-6a", "Grade 6", "A"],
  ["cls-6b", "Grade 6", "B"],
  ["cls-7a", "Grade 7", "A"],
  ["cls-7b", "Grade 7", "B"],
  ["cls-8a", "Grade 8", "A"],
  ["cls-8b", "Grade 8", "B"],
];
export const CLASSES = CLASS_DEFS.map(([id, class_name, stream]) => ({
  id,
  school_id: SCHOOL.id,
  class_name,
  stream,
  label: `${class_name} ${stream}`,
}));

export const SUBJECTS = [
  { id: 1, name: "Mathematics", code: "MAT" },
  { id: 2, name: "English", code: "ENG" },
  { id: 3, name: "Kiswahili", code: "KIS" },
  { id: 4, name: "Integrated Science", code: "SCI" },
  { id: 5, name: "Social Studies", code: "SST" },
  { id: 6, name: "Christian Religious Education", code: "CRE" },
  { id: 7, name: "Creative Arts", code: "ART" },
  { id: 8, name: "Agriculture and Nutrition", code: "AGR" },
];

// [first name, last name, class index]; the first student is the demo student, the second her sibling.
const STUDENT_DEFS: Array<[string, string, number]> = [
  ["Zawadi", "Hassan", 2], ["Imani", "Hassan", 1], ["Brian", "Otieno", 0], ["Faith", "Wanjiku", 0],
  ["Kevin", "Mutiso", 0], ["Lucy", "Chebet", 0], ["Joseph", "Kariuki", 1], ["Mary", "Akinyi", 1],
  ["Ali", "Abdi", 1], ["Peter", "Njoroge", 2], ["Esther", "Naliaka", 2], ["Hamisi", "Juma", 2],
  ["Grace", "Mwende", 3], ["Samuel", "Kiptoo", 3], ["Ruth", "Atieno", 3], ["Omar", "Farah", 3],
  ["Naomi", "Wairimu", 4], ["David", "Odhiambo", 4], ["Halima", "Salim", 4], ["John", "Maina", 4],
  ["Sharon", "Jeptoo", 5], ["Victor", "Ouma", 5], ["Fatuma", "Ali", 5], ["Collins", "Mugo", 5],
];

// [first name, last name, subject id, class indexes taught, is class teacher]
const TEACHER_DEFS: Array<[string, string, number, number[], boolean]> = [
  ["Mercy", "Achieng", 1, [2, 3, 4], true],
  ["Daniel", "Kiprop", 2, [0, 1], true],
  ["Joyce", "Mwangi", 3, [2, 3], false],
  ["Samuel", "Mutua", 4, [4, 5], true],
  ["Lilian", "Njeri", 5, [0, 5], false],
  ["Peter", "Otieno", 6, [1, 4], false],
];

export const studentId = (i: number) => `stu-${String(i + 1).padStart(3, "0")}`;
export const teacherId = (i: number) => `tch-${String(i + 1).padStart(3, "0")}`;
/** Position of a student id in STUDENT_DEFS, or -1 when the id is unknown. */
export const studentIndex = (id: string) => (/^stu-\d{3}$/.test(id) ? Number(id.slice(4)) - 1 : -1);
export const STUDENT_COUNT = STUDENT_DEFS.length;

export const studentName = (i: number) => `${STUDENT_DEFS[i][0]} ${STUDENT_DEFS[i][1]}`;
export const studentClass = (i: number) => CLASSES[STUDENT_DEFS[i][2]];
export const studentAdmissionNo = (i: number) => `DEMO/${2026 - Math.floor(STUDENT_DEFS[i][2] / 2) - 1}/${String(i + 1).padStart(3, "0")}`;

/** Percentage for one student and subject, stable between runs (45 to 92). */
export const scorePct = (i: number, s: number) => 45 + ((i * 7 + s * 11 + 3) % 48);
export const studentAvgPct = (i: number) =>
  Math.round((SUBJECTS.reduce((sum, _, s) => sum + scorePct(i, s), 0) / SUBJECTS.length) * 10) / 10;
export const studentAvgGrade = (i: number) => scoreToGrade(studentAvgPct(i));

export function studentGrades(i: number): GradeRow[] {
  return SUBJECTS.map((sub, s) => ({
    subject: sub.name,
    term: TERM,
    grade: scoreToGrade(scorePct(i, s)),
    rawScore: scorePct(i, s),
    normalizedPct: scorePct(i, s),
    createdAt: `2026-07-${String(10 + s).padStart(2, "0")}T09:00:00.000Z`,
  }));
}

export function studentAttendance(i: number): AttendanceSummary {
  const total = 40;
  const absent = i % 4;
  const late = i % 3;
  const present = total - absent - late;
  return { present, late, absent, total, rate: Math.round(((present + late) / total) * 100) };
}

export const teacherName = (t: number) => `${TEACHER_DEFS[t][0]} ${TEACHER_DEFS[t][1]}`;
/** Teacher index who teaches a subject (one per subject; the rest fall back to the first teacher). */
const teacherForSubject = (subjectId: number) => Math.max(0, TEACHER_DEFS.findIndex((t) => t[2] === subjectId));
export const classTeacherName = (classIdx: number) => {
  const t = TEACHER_DEFS.findIndex((d) => d[4] && d[3][0] === classIdx);
  return t >= 0 ? teacherName(t) : null;
};

export function studentSubjects(i: number): SubjectSummary[] {
  return SUBJECTS.map((sub, s) => ({
    id: `sub-${sub.id}`,
    name: sub.name,
    teacherName: teacherName(teacherForSubject(sub.id)),
    averagePct: scorePct(i, s),
    latestGrade: scoreToGrade(scorePct(i, s)),
  }));
}

/** Today's lessons; the date and weekday come from the clock so the page never looks stale. */
export function todaySchedule(className: string | null, teacher: string | null): TodaySchedule {
  const now = new Date();
  const slot = (n: number, start: string, end: string, subject: string): LessonSlot => ({
    id: `lesson-${n}`,
    startTime: start,
    endTime: end,
    itemType: "class",
    title: subject,
    room: `Room ${n + 1}`,
    className,
    subjectName: subject,
    teacherName: teacher,
  });
  return {
    date: now.toISOString().slice(0, 10),
    weekday: now.toLocaleDateString("en-GB", { weekday: "long" }),
    lessons: [
      slot(1, "08:00", "08:40", "Mathematics"),
      slot(2, "08:40", "09:20", "English"),
      slot(3, "09:40", "10:20", "Integrated Science"),
      slot(4, "10:20", "11:00", "Kiswahili"),
    ],
  };
}

export function seedStudents(): StudentListItem[] {
  return STUDENT_DEFS.map(([first, last, c], i) => {
    const cls = CLASSES[c];
    return {
      id: studentId(i),
      user_id: `user-${studentId(i)}`,
      school_id: SCHOOL.id,
      school_name: SCHOOL.name,
      admission_no: studentAdmissionNo(i),
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      class_id: cls.id,
      class_label: cls.label,
      date_of_birth: `${2014 - Math.floor(c / 2)}-0${(i % 9) + 1}-1${i % 9}`,
      phone: `+2547000${String(100 + i).padStart(5, "0")}`,
      phone2: i % 2 ? `+2547110${String(100 + i).padStart(5, "0")}` : null,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@demo.stackable.school`,
      profile_picture: null,
      status: i === 23 ? "pending" : "active",
      average_grade: studentAvgGrade(i),
      parents_count: (i % 2) + 1,
      created_at: CREATED_AT,
    };
  });
}

export function seedTeachers(): TeacherListItem[] {
  return TEACHER_DEFS.map(([first, last, subjectId, classIdxs, isClassTeacher], t) => ({
    id: teacherId(t),
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@demo.stackable.school`,
    phone: `+2547220${String(100 + t).padStart(5, "0")}`,
    admission_number: `TSC-DEMO-${String(t + 1).padStart(3, "0")}`,
    subject_id: subjectId,
    school_id: SCHOOL.id,
    profile_photo: null,
    status: "active",
    created_at: CREATED_AT,
    days_present: 36 - t,
    total_school_days: 40,
    attendance_percentage: Math.round(((36 - t) / 40) * 100),
    class_teacher: isClassTeacher,
    school_name: SCHOOL.name,
    subject_name: SUBJECTS.find((s) => s.id === subjectId)?.name ?? null,
    class_labels: classIdxs.map((c) => CLASSES[c].label),
  }));
}

/** Class indexes a teacher teaches, from the fixed teacher table. */
export const teacherClassIdxs = (t: number) => TEACHER_DEFS[t][3];
export const TEACHER_COUNT = TEACHER_DEFS.length;
export const classIndexOf = (classId: string | null) => CLASSES.findIndex((c) => c.id === classId);

/** Read a list the seed put in the demo db; an empty list when it is missing. */
export function table<T>(db: Record<string, unknown>, key: string): T[] {
  const value = db[key];
  return Array.isArray(value) ? (value as T[]) : [];
}
