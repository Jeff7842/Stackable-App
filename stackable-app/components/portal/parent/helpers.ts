// =============================================================================
// Parent portal helpers - PURE (no React). Family-level maths over the ChildCard[]
// list plus a few formatters. Same rule as the student helpers: only REAL numbers are
// aggregated; a missing attendance rate or average never becomes 0.
// =============================================================================

import type { ChildCard, GradeRow } from "@/lib/repositories/portal-types";
import { fullName, isNewer, meanOf } from "../student/helpers";

export function childName(child: Pick<ChildCard, "firstName" | "lastName">): string {
  return fullName(child.firstName, child.lastName);
}

/** "legal_guardian" -> "Legal guardian", "mother" -> "Mother". */
export function relationshipLabel(relationship: string | null | undefined): string {
  const text = (relationship ?? "").trim().replace(/[_-]+/g, " ");
  if (!text) return "Guardian";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/** Mean attendance rate over the children that have one; rate is null when none do. */
export function familyAttendance(children: ChildCard[]): { rate: number | null; counted: number } {
  const rates = children.flatMap((c) => (c.attendanceRate == null ? [] : [c.attendanceRate]));
  const mean = meanOf(rates);
  return { rate: mean === null ? null : Math.round(mean), counted: rates.length };
}

/** Mean of the real average scores; null when no child has one. */
export function familyAverage(children: ChildCard[]): number | null {
  return meanOf(children.map((c) => c.averagePct));
}

export function gradedCount(children: ChildCard[]): number {
  return children.filter((c) => c.latestGrade !== null).length;
}

export function totalSubjects(children: ChildCard[]): number {
  return children.reduce((sum, c) => sum + c.subjectCount, 0);
}

/** Case-insensitive match on name, admission number, class or relationship. */
export function filterChildren(children: ChildCard[], query: string): ChildCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return children;
  return children.filter((c) =>
    [childName(c), c.admissionNo, c.className ?? "", c.relationship].some((field) => field.toLowerCase().includes(q)),
  );
}

/** The newest term on record and how many subjects were graded in it; null with no grades. */
export function latestTerm(grades: GradeRow[]): { term: string; subjectCount: number } | null {
  let newest: GradeRow | null = null;
  for (const g of grades) {
    if (!newest || isNewer(g, newest)) newest = g;
  }
  if (!newest) return null;
  const term = newest.term;
  const subjects = new Set(grades.filter((g) => g.term === term).map((g) => g.subject.trim().toLowerCase()));
  return { term, subjectCount: subjects.size };
}
