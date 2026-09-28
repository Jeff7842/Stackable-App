// =============================================================================
// Grade points — how a student's letter grades become one average number.
// -----------------------------------------------------------------------------
// The old admin pages read a database VIEW called `student_average_grade`
// (columns student_id, avg_score) and turned avg_score into a letter with
// scoreToGrade() in lib/teachers.ts. That view does not exist in Neon/Prisma, so
// the Prisma path recomputes it from grading_reports.grade.
//
// The scale is INFERRED from scoreToGrade()'s thresholds (A >= 11.5, B+ >= 10.5 ...
// F < 1.5): twelve letters worth 12 down to 1. If the real view used a different
// formula, change GRADE_POINTS here - it is the single source for the Prisma path.
// =============================================================================

/** Letter grade -> points. Anything not listed (e.g. "A-", "P", "") is ignored in averages. */
export const GRADE_POINTS: Readonly<Record<string, number>> = {
  A: 12,
  "B+": 11,
  B: 10,
  "B-": 9,
  "C+": 8,
  C: 7,
  "C-": 6,
  "D+": 5,
  D: 4,
  "D-": 3,
  E: 2,
  F: 1,
};

/** Points for a letter grade, or null when the letter is not on the scale. */
export function gradeToPoints(grade: string | null | undefined): number | null {
  const key = String(grade ?? "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, key) ? GRADE_POINTS[key] : null;
}

/**
 * Average points from grouped grade counts (what a GROUP BY grade query returns).
 *
 * @param rows one entry per distinct grade letter with how many results have it
 * @returns the mean rounded to 2 decimals, or null when no result is on the scale
 */
export function averagePointsFromCounts(
  rows: ReadonlyArray<{ grade: string; count: number }>,
): number | null {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const points = gradeToPoints(row.grade);
    if (points === null || row.count <= 0) continue;
    total += points * row.count;
    count += row.count;
  }
  return count === 0 ? null : Math.round((total / count) * 100) / 100;
}
