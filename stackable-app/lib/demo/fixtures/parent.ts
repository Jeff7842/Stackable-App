// Parent portal handlers: the demo parent has two children, the demo student and her sibling.
import type { ChildCard, ChildOverview } from "@/lib/repositories/portal-types";
import { route } from "../router";
import { SUBJECTS, studentAttendance, studentAvgGrade, studentAvgPct, studentGrades, studentId, studentIndex, studentSubjects } from "./data";
import { studentSummary } from "./student";

const CHILD_INDEXES = [0, 1];

function childCard(i: number): ChildCard {
  const s = studentSummary(i);
  const latest = studentGrades(i)[0];
  return {
    studentId: studentId(i),
    firstName: s.firstName,
    lastName: s.lastName,
    admissionNo: s.admissionNo,
    className: s.className,
    profilePicture: null,
    averageGrade: studentAvgGrade(i),
    relationship: "mother",
    isPrimary: i === 0,
    subjectCount: SUBJECTS.length,
    averagePct: studentAvgPct(i),
    attendanceRate: studentAttendance(i).rate,
    latestGrade: { subject: latest.subject, term: latest.term, grade: latest.grade, normalizedPct: latest.normalizedPct },
  };
}

export function childOverview(i: number): ChildOverview {
  return {
    student: studentSummary(i),
    grades: studentGrades(i),
    attendance: studentAttendance(i),
    subjects: studentSubjects(i),
  };
}

export function registerParent(): void {
  route("GET", "/api/parent/children", () => ({ ok: true, data: CHILD_INDEXES.map(childCard) }));
  route("GET", "/api/parent/children/:studentId", ({ params }) => {
    const i = studentIndex(params.studentId);
    if (i < 0) return { status: 400, body: { error: "That student id is not valid.", code: "BAD_REQUEST" } };
    if (!CHILD_INDEXES.includes(i)) {
      return { status: 403, body: { error: "This student is not linked to your account.", code: "FORBIDDEN" } };
    }
    return { ok: true, data: childOverview(i) };
  });
}
