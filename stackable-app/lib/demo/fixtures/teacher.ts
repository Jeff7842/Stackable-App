// Teacher portal handlers: the demo teacher is the first sample teacher and sees only their own classes.
import type { StudentListItem } from "@/lib/dto/students";
import type {
  TeacherAttentionItem,
  TeacherGradeEntry,
  TeacherPortalData,
  TeacherStudent,
  TeacherStudentProfile,
} from "@/lib/repositories/portal-types";
import { route, type DemoRequest } from "../router";
import {
  CLASSES,
  SCHOOL,
  SUBJECTS,
  classIndexOf,
  scorePct,
  seedTeachers,
  studentAttendance,
  studentAvgGrade,
  studentAvgPct,
  studentGrades,
  studentIndex,
  table,
  teacherClassIdxs,
  todaySchedule,
} from "./data";

const DEMO_TEACHER_INDEX = 0;

/** Students in the classes the demo teacher teaches, read from the session db. */
function assigned(db: DemoRequest["db"]): StudentListItem[] {
  const classIds = teacherClassIdxs(DEMO_TEACHER_INDEX).map((c) => CLASSES[c].id);
  return table<StudentListItem>(db, "students").filter((s) => s.class_id && classIds.includes(s.class_id) && s.status !== "removed");
}

function toTeacherStudent(s: StudentListItem): TeacherStudent {
  const i = studentIndex(s.id);
  return {
    id: s.id,
    firstName: s.first_name ?? "",
    lastName: s.last_name,
    admissionNo: s.admission_no,
    status: s.status,
    classId: s.class_id,
    className: s.class_label,
    profilePicture: s.profile_picture,
    averageGrade: i >= 0 ? studentAvgGrade(i) : s.average_grade,
    averagePct: i >= 0 ? studentAvgPct(i) : null,
    attendanceRate: i >= 0 ? studentAttendance(i).rate : null,
  };
}

function portalData(db: DemoRequest["db"]): TeacherPortalData {
  const me = seedTeachers()[DEMO_TEACHER_INDEX];
  const students = assigned(db);
  const classes = teacherClassIdxs(DEMO_TEACHER_INDEX).map((c) => ({
    id: CLASSES[c].id,
    name: CLASSES[c].class_name,
    stream: CLASSES[c].stream,
    totalStudents: students.filter((s) => s.class_id === CLASSES[c].id).length,
    studentCount: students.filter((s) => s.class_id === CLASSES[c].id).length,
    presentToday: null,
  }));
  const recentGrading: TeacherGradeEntry[] = students.slice(0, 6).map((s) => ({
    id: `grade-${s.id}`,
    studentId: s.id,
    studentName: s.full_name,
    className: s.class_label,
    subject: SUBJECTS[0].name,
    term: "Term 2 2026",
    grade: studentGrades(studentIndex(s.id))[0].grade,
    normalizedPct: scorePct(studentIndex(s.id), 0),
    createdAt: "2026-07-10T09:00:00.000Z",
  }));
  const attention: TeacherAttentionItem[] = students
    .map((s) => ({ s, pct: studentAvgPct(studentIndex(s.id)) }))
    .filter((x) => x.pct < 62)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6)
    .map(({ s, pct }) => ({ studentId: s.id, name: s.full_name, className: s.class_label, averagePct: pct, reason: "low-average" as const }));
  return {
    teacher: { id: me.id, name: me.name, email: me.email, status: me.status },
    schoolName: SCHOOL.name,
    classes,
    subjects: [{ id: "sub-1", subjectName: SUBJECTS[0].name }],
    studentCount: students.length,
    today: todaySchedule(CLASSES[teacherClassIdxs(DEMO_TEACHER_INDEX)[0]].label, me.name),
    recentGrading,
    attention,
  };
}

export function registerTeacher(): void {
  route("GET", "/api/teach/portal-data", ({ db }) => ({ ok: true, data: portalData(db) }));
  route("GET", "/api/teach/students", ({ db }) => {
    const students = assigned(db).map(toTeacherStudent);
    return { ok: true, data: { students, total: students.length } };
  });
  route("GET", "/api/teach/students/:studentId", ({ db, params }) => {
    const row = assigned(db).find((s) => s.id === params.studentId);
    const i = studentIndex(params.studentId);
    if (!row || i < 0 || classIndexOf(row.class_id) < 0) {
      return { status: 404, body: { error: "That student is not assigned to you.", code: "NOT_FOUND" } };
    }
    const data: TeacherStudentProfile = {
      student: { ...toTeacherStudent(row), dateOfBirth: row.date_of_birth, email: row.email },
      grades: studentGrades(i),
      attendance: studentAttendance(i),
    };
    return { ok: true, data };
  });
}
