// Student portal handlers: the demo student is the first sample student.
import type { StudentDashboardData } from "@/lib/repositories/portal-types";
import { route } from "../router";
import {
  SUBJECTS,
  classIndexOf,
  classTeacherName,
  seedStudents,
  studentAttendance,
  studentAvgGrade,
  studentAvgPct,
  studentClass,
  studentGrades,
  studentSubjects,
  todaySchedule,
} from "./data";

export const DEMO_STUDENT_INDEX = 0;

/** The student block shared by the dashboard and the parent's child overview. */
export function studentSummary(i: number) {
  const row = seedStudents()[i];
  const cls = studentClass(i);
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    admissionNo: row.admission_no,
    className: cls.label,
    averageGrade: studentAvgGrade(i),
    averagePct: studentAvgPct(i),
    status: "active",
    profilePicture: null,
    dateOfBirth: row.date_of_birth,
    classTeacherName: classTeacherName(classIndexOf(cls.id)),
  };
}

export function studentDashboard(i: number): StudentDashboardData {
  const { averagePct: _pct, dateOfBirth: _dob, ...student } = studentSummary(i);
  return {
    student,
    subjectCount: SUBJECTS.length,
    grades: studentGrades(i),
    attendance: studentAttendance(i),
    subjects: studentSubjects(i),
    today: todaySchedule(student.className, classTeacherName(classIndexOf(studentClass(i).id))),
  };
}

export function registerStudent(): void {
  route("GET", "/api/student/dashboard", () => ({ ok: true, data: studentDashboard(DEMO_STUDENT_INDEX) }));
  route("GET", "/api/student/grades", () => ({ ok: true, data: studentGrades(DEMO_STUDENT_INDEX) }));
}
