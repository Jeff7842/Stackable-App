import { renderToString } from "react-dom/server";
import type { ChildCard, GradeRow, ChildOverview, StudentDashboardData } from "@/lib/repositories/portal-types";
import { ChildCardFull, ChildRow } from "@/components/portal/parent/ChildCardView";
import { SubjectsGrid } from "@/components/portal/student/SubjectsGrid";
import { LatestGrades } from "@/components/portal/student/LatestGrades";
import { TermMatrix } from "@/components/portal/student/TermMatrix";
import { GradeMixBlock, AttendanceBlock } from "@/components/portal/student/parts";
import { GradeInsights } from "@/components/portal/student/GradeInsights";
import { UpcomingPanel } from "@/components/portal/student/UpcomingPanel";
import { ProgressPanel } from "@/components/portal/student/ProgressPanel";
import { StudentHomeSkeleton } from "@/components/portal/student/StudentHomeSkeleton";
import { GradesSkeleton } from "@/components/portal/student/GradesSkeleton";
import { FamilyHomeSkeleton, ChildProfileSkeleton, ChildrenListSkeleton } from "@/components/portal/parent/FamilySkeletons";
import { buildSubjectCards, gradeMix, summarizeGrades, sortNewestFirst } from "@/components/portal/student/helpers";
import { normalizeStudentDashboard, normalizeChildCards, normalizeChildOverview } from "@/components/portal/student/normalize";

const g = (subject: string, term: string, grade: string, createdAt: string | null): GradeRow => ({ subject, term, grade, rawScore: null, normalizedPct: null, createdAt });
const grades = [g("Maths", "Term 1", "B", "2026-02-01T00:00:00Z"), g("Maths", "Term 2", "A", "2026-05-01T00:00:00Z"), g("English", "Term 2", "C", "2026-05-02T00:00:00Z"), g("Science", "Term 2", "D", "2026-05-03T00:00:00Z")];
const child: ChildCard = { studentId: "s1", firstName: "Amina", lastName: "Otieno", admissionNo: "A1", className: "Grade 5", profilePicture: null, averageGrade: null, relationship: "mother", isPrimary: true, subjectCount: 6, averagePct: null, attendanceRate: null, latestGrade: { subject: "Maths", term: "Term 2", grade: "A", normalizedPct: null } };
const att0 = { present: 0, late: 0, absent: 0, total: 0, rate: 0 };

const parts: Record<string, () => React.ReactNode> = {
  ChildCardFull: () => <ChildCardFull child={child} />,
  ChildCardFullRate: () => <ChildCardFull child={{ ...child, attendanceRate: 92, averagePct: 71, averageGrade: "B", latestGrade: null }} />,
  ChildRow: () => <ChildRow child={child} />,
  ChildRowRate: () => <ChildRow child={{ ...child, attendanceRate: 60, latestGrade: null }} />,
  Subjects: () => <SubjectsGrid cards={buildSubjectCards([{ id: "1", name: "Maths", teacherName: null, averagePct: null, latestGrade: "A" }], grades)} />,
  SubjectsNoLink: () => <SubjectsGrid cards={[]} linkFor={() => null} allHref={null} />,
  Latest: () => <LatestGrades grades={sortNewestFirst(grades)} epochMinute={0} />,
  Matrix: () => <TermMatrix rows={grades} terms={["Term 1", "Term 2"]} />,
  Mix: () => <GradeMixBlock mix={gradeMix(grades)} overall="A" />,
  MixEmpty: () => <GradeMixBlock mix={gradeMix([])} overall={null} />,
  Attendance0: () => <AttendanceBlock attendance={att0} />,
  Insights: () => <GradeInsights rows={grades} />,
  Upcoming0: () => <UpcomingPanel today={{ date: "", weekday: "", lessons: [] }} nowMin={null} />,
  Progress: () => <ProgressPanel summary={summarizeGrades(grades)} mix={gradeMix(grades)} attendance={att0} />,
  Skeletons: () => (<><StudentHomeSkeleton /><GradesSkeleton /><FamilyHomeSkeleton /><ChildProfileSkeleton /><ChildrenListSkeleton /></>),
};
let failed = 0;
for (const [name, render] of Object.entries(parts)) {
  try { const html = renderToString(render() as React.ReactElement); console.log("ok  ", name, html.length); }
  catch (e) { failed++; console.log("FAIL", name, (e as Error).message); }
}
// Normalisers on hostile input (older backend / nulls).
try {
  normalizeStudentDashboard({ student: { id: "x", lastName: "L" } });
  normalizeChildCards([{ studentId: "a" }, {}, null]);
  normalizeChildOverview({ student: { id: "x" }, grades: [{ subject: "M" }] });
  console.log("ok   normalizers");
} catch (e) { failed++; console.log("FAIL normalizers", (e as Error).message); }
process.exit(failed ? 1 : 0);
