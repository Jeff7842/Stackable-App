// Tiny runnable check for the parent (family-level) maths.
//   pnpm exec tsx components/portal/parent/helpers.check.ts

import assert from "node:assert/strict";
import type { ChildCard, GradeRow } from "@/lib/repositories/portal-types";
import { familyAttendance, familyAverage, filterChildren, gradedCount, latestTerm, relationshipLabel } from "./helpers";

const child = (over: Partial<ChildCard>): ChildCard => ({
  studentId: "id",
  firstName: "Amina",
  lastName: "Otieno",
  admissionNo: "ADM-001",
  className: "Grade 5 East",
  profilePicture: null,
  averageGrade: null,
  relationship: "mother",
  isPrimary: true,
  subjectCount: 6,
  averagePct: null,
  attendanceRate: null,
  latestGrade: null,
  ...over,
});

// Letters-only reality: nothing recorded -> nothing invented.
const empty = [child({}), child({ studentId: "b", firstName: "Brian" })];
assert.deepEqual(familyAttendance(empty), { rate: null, counted: 0 });
assert.equal(familyAverage(empty), null);
assert.equal(gradedCount(empty), 0);

// With numbers: only the children that have one count.
const mixed = [child({ attendanceRate: 90, averagePct: 70 }), child({ studentId: "b", attendanceRate: 80 }), child({ studentId: "c" })];
assert.deepEqual(familyAttendance(mixed), { rate: 85, counted: 2 });
assert.equal(familyAverage(mixed), 70);
assert.equal(gradedCount([child({ latestGrade: { subject: "Maths", term: "T1", grade: "A", normalizedPct: null } })]), 1);

// Search.
assert.equal(filterChildren(mixed, "").length, 3);
assert.equal(filterChildren(mixed, "amina").length, 3);
assert.equal(filterChildren(mixed, "adm-001").length, 3);
assert.equal(filterChildren(mixed, "zzz").length, 0);

assert.equal(relationshipLabel("legal_guardian"), "Legal guardian");
assert.equal(relationshipLabel("MOTHER"), "Mother");
assert.equal(relationshipLabel(""), "Guardian");

const row = (subject: string, term: string, grade: string): GradeRow => ({
  subject,
  term,
  grade,
  rawScore: null,
  normalizedPct: null,
  createdAt: null,
});
assert.equal(latestTerm([]), null);
assert.deepEqual(latestTerm([row("Maths", "Term 1", "B"), row("Maths", "Term 2", "A"), row("Art", "Term 2", "B")]), {
  term: "Term 2",
  subjectCount: 2,
});

console.log("parent helpers: all checks passed");
