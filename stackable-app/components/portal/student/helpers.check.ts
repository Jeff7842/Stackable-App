// Tiny runnable check for the grade banding + attendance maths.
//   pnpm exec tsx components/portal/student/helpers.check.ts
// Exits non-zero on the first failed assertion.

import assert from "node:assert/strict";
import type { GradeRow } from "@/lib/repositories/portal-types";
import {
  attendanceRate,
  attendanceTone,
  buildSubjectCards,
  computeAttendanceRate,
  gradeBand,
  gradeMix,
  gradeRank,
  hasAttendance,
  initialsOf,
  overallGrade,
  performanceLabel,
  scoreTrend,
  share,
  subjectTrend,
  summarizeGrades,
  termsOf,
} from "./helpers";

const row = (subject: string, term: string, grade: string, createdAt: string | null = null, pct: number | null = null): GradeRow => ({
  subject,
  term,
  grade,
  rawScore: null,
  normalizedPct: pct,
  createdAt,
});

// Banding: A/B strong, C fair, D/E/F low, junk unknown.
assert.equal(gradeBand("A"), "top");
assert.equal(gradeBand("a-"), "top");
assert.equal(gradeBand("B+"), "top");
assert.equal(gradeBand("B-"), "top");
assert.equal(gradeBand("C+"), "fair");
assert.equal(gradeBand("C"), "fair");
assert.equal(gradeBand("C-"), "fair");
assert.equal(gradeBand("D+"), "low");
assert.equal(gradeBand("D"), "low");
assert.equal(gradeBand("E"), "low");
assert.equal(gradeBand("F"), "low");
assert.equal(gradeBand(""), "unknown");
assert.equal(gradeBand(null), "unknown");
assert.equal(gradeBand("Pass"), "unknown");
// CBC levels and bare numbers.
assert.equal(gradeBand("EE1"), "top");
assert.equal(gradeBand("ME2"), "top");
assert.equal(gradeBand("AE"), "fair");
assert.equal(gradeBand("BE1"), "low");
assert.equal(gradeBand("78"), "top");
assert.equal(gradeBand("55%"), "fair");
assert.equal(gradeBand("30"), "low");
assert.equal(gradeBand("140"), "unknown");

// Ordering.
assert.ok((gradeRank("A") as number) > (gradeRank("A-") as number));
assert.ok((gradeRank("B+") as number) > (gradeRank("B") as number));
assert.ok((gradeRank("D") as number) > (gradeRank("E") as number));
assert.equal(performanceLabel("A"), "Excellent");
assert.equal(performanceLabel("B"), "Good");
assert.equal(performanceLabel("C"), "Satisfactory");
assert.equal(performanceLabel("D"), "Needs improvement");
assert.equal(performanceLabel("E"), "Needs support");
assert.equal(performanceLabel("??"), "");

// Overall grade: server value wins, else most common latest letter, tie -> newest.
const grades = [
  row("Maths", "Term 1", "B", "2026-02-01T00:00:00Z"),
  row("Maths", "Term 2", "A", "2026-05-01T00:00:00Z"),
  row("English", "Term 2", "A", "2026-05-02T00:00:00Z"),
  row("Science", "Term 2", "C", "2026-05-03T00:00:00Z"),
  row("History", "Term 2", "D", "2026-05-04T00:00:00Z"),
];
assert.equal(overallGrade(grades), "A"); // A: Maths(latest)+English
assert.equal(overallGrade(grades, "B+"), "B+");
assert.equal(overallGrade([]), null);
assert.equal(overallGrade([row("Maths", "T1", "B", "2026-01-01T00:00:00Z"), row("Art", "T1", "C", "2026-01-02T00:00:00Z")]), "C"); // tie -> newer

const s = summarizeGrades(grades);
assert.equal(s.best?.grade, "A");
assert.deepEqual(s.attention.map((a) => a.subject), ["History"]);
assert.equal(s.subjectCount, 4);
assert.equal(s.reportCount, 5);
assert.equal(s.averagePct, null); // letters only: never invented

assert.deepEqual(gradeMix(grades), { top: 3, fair: 1, low: 1, unknown: 0 });
assert.deepEqual(termsOf(grades), ["Term 1", "Term 2"]);
assert.equal(scoreTrend(grades), null); // no real numbers -> no trend chart
const numeric = [row("Maths", "Term 1", "B", null, 60), row("Maths", "Term 2", "A", null, 80)];
assert.deepEqual(scoreTrend(numeric), { categories: ["Term 1", "Term 2"], data: [60, 80] });

// Subject trend + cards.
assert.equal(subjectTrend(grades.filter((g) => g.subject === "Maths")), "up");
assert.equal(subjectTrend([row("Art", "T1", "B")]), null);
const cards = buildSubjectCards([{ id: "1", name: "Maths", teacherName: "Ms Wanjiru", averagePct: null, latestGrade: "A" }], grades);
assert.equal(cards[0].name, "Maths");
assert.equal(cards[0].teacherName, "Ms Wanjiru");
assert.equal(cards.length, 4); // Maths + 3 grade-only subjects
assert.equal(cards[0].averagePct, null);

// Attendance.
assert.equal(computeAttendanceRate(18, 1, 20), 95);
assert.equal(computeAttendanceRate(0, 0, 0), null);
assert.equal(hasAttendance({ present: 0, late: 0, absent: 0, total: 0, rate: 0 }), false);
assert.equal(attendanceRate({ present: 0, late: 0, absent: 0, total: 0, rate: 0 }), null); // never "0%"
assert.equal(attendanceRate({ present: 9, late: 0, absent: 1, total: 10, rate: 90 }), 90);
assert.equal(attendanceTone(95), "success");
assert.equal(attendanceTone(80), "warning");
assert.equal(attendanceTone(60), "danger");
assert.equal(share(1, 4), 25);
assert.equal(share(1, 0), 0);

// Names.
assert.equal(initialsOf("Amina Otieno"), "AO");
assert.equal(initialsOf(""), "?");

console.log("portal helpers: all checks passed");
