// =============================================================================
// Student + parent portal helpers - PURE (no React, no server imports), so they
// can be unit-checked with `pnpm exec tsx components/portal/student/helpers.check.ts`.
//
// DATA REALITY (letters-only): today the school records LETTER grades only.
// `normalizedPct`, `rawScore`, `averagePct`, `averageGrade` and `attendanceRate`
// are usually null. Nothing in this file invents a percentage from a letter:
//   - gradeRank() turns a letter into a 0-5 position ONLY to order grades
//     (best / weakest subject, trend direction). It is never displayed.
//   - every "%" a page shows must come from a real number the API sent.
// =============================================================================

import type { BadgeTone } from "@/components/ui";
import type { AttendanceSummary, GradeRow, SubjectSummary } from "@/lib/repositories/portal-types";

// ---- Grades: letter -> band -------------------------------------------------
export type GradeBand = "top" | "fair" | "low" | "unknown";

const LETTER_BASE: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
// Kenyan CBC performance levels, mapped onto the same 0-5 scale as letters.
const CBC_BASE: Record<string, number> = { EE: 5, ME: 4, AE: 3, BE: 1.5 };

/**
 * Position of a grade on a 0-5 scale (A = 5 ... F = 0, "+" / "-" nudge by a third;
 * CBC EE/ME/AE/BE with an optional 1/2 sub-level; a bare 0-100 number counts as pct / 20).
 * null when the grade is not understood. ORDERING ONLY - never shown to the user.
 */
export function gradeRank(grade: string | null | undefined): number | null {
  const g = (grade ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!g) return null;

  const cbc = /^(EE|ME|AE|BE)([12])?$/.exec(g);
  if (cbc) {
    const nudge = cbc[2] === "1" ? 0.25 : cbc[2] === "2" ? -0.25 : 0;
    return CBC_BASE[cbc[1]] + nudge;
  }

  const letter = /^([A-F])([+-])?$/.exec(g);
  if (letter) {
    const nudge = letter[2] === "+" ? 1 / 3 : letter[2] === "-" ? -1 / 3 : 0;
    return LETTER_BASE[letter[1]] + nudge;
  }

  // Some schools store the percentage as the grade text ("78" or "78%").
  const numeric = /^(\d{1,3}(?:\.\d+)?)%?$/.exec(g);
  if (numeric) {
    const n = Number(numeric[1]);
    return n >= 0 && n <= 100 ? n / 20 : null;
  }
  return null;
}

/** A/B (EE/ME) = top, C (AE) = fair, D/E/F (BE) = low, anything else = unknown. */
export function gradeBand(grade: string | null | undefined): GradeBand {
  const rank = gradeRank(grade);
  if (rank === null) return "unknown";
  if (rank >= 3.5) return "top";
  if (rank >= 2.5) return "fair";
  return "low";
}

const BAND_TONE: Record<GradeBand, BadgeTone> = {
  top: "success",
  fair: "info",
  low: "error",
  unknown: "neutral",
};

/** Badge tone for a band. */
export function bandTone(band: GradeBand): BadgeTone {
  return BAND_TONE[band];
}

/** Badge tone for a grade letter. */
export function gradeTone(grade: string | null | undefined): BadgeTone {
  return BAND_TONE[gradeBand(grade)];
}

export const BAND_LABEL: Record<GradeBand, string> = {
  top: "Strong",
  fair: "Fair",
  low: "Needs support",
  unknown: "Ungraded",
};

/**
 * Generic wording for how a letter is doing. Derived from the letter only (the API does
 * not carry teacher remarks yet), so the UI calls this "Performance", not "Remark".
 */
export function performanceLabel(grade: string | null | undefined): string {
  const rank = gradeRank(grade);
  if (rank === null) return "";
  if (rank >= 4.5) return "Excellent";
  if (rank >= 3.5) return "Good";
  if (rank >= 2.5) return "Satisfactory";
  if (rank >= 1.5) return "Needs improvement";
  return "Needs support";
}

/** Percentage-based tone (only ever called with a REAL score): >= 75 top, >= 50 fair, else low. */
export function pctBand(pct: number | null | undefined): GradeBand {
  if (pct == null || Number.isNaN(pct)) return "unknown";
  if (pct >= 75) return "top";
  if (pct >= 50) return "fair";
  return "low";
}

// ---- Grades: ordering + aggregation ----------------------------------------
/** "Term 2" after "Term 1", "Term 10" after "Term 9". */
export function compareTerms(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function timeOf(row: GradeRow): number {
  const ms = Date.parse(row.createdAt ?? "");
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/** Is `a` more recent than `b`? Newer createdAt wins; without dates the later term name wins. */
export function isNewer(a: GradeRow, b: GradeRow): boolean {
  const at = timeOf(a);
  const bt = timeOf(b);
  if (at !== bt) return at > bt;
  return compareTerms(a.term, b.term) > 0;
}

/** Newest first (copy; the input is untouched). */
export function sortNewestFirst(grades: GradeRow[]): GradeRow[] {
  return [...grades].sort((a, b) => (isNewer(a, b) ? -1 : isNewer(b, a) ? 1 : 0));
}

/** Oldest first (copy). */
export function sortOldestFirst(grades: GradeRow[]): GradeRow[] {
  return sortNewestFirst(grades).reverse();
}

function subjectKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The newest report of every subject (one row per subject). */
export function latestPerSubject(grades: GradeRow[]): GradeRow[] {
  const latest = new Map<string, GradeRow>();
  for (const row of grades) {
    const key = subjectKey(row.subject);
    const current = latest.get(key);
    if (!current || isNewer(row, current)) latest.set(key, row);
  }
  return Array.from(latest.values());
}

function isRealNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Mean of the real percentages in `values`, one decimal; null when there are none. */
export function meanOf(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(isRealNumber);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((sum, v) => sum + v, 0) / nums.length) * 10) / 10;
}

/** Mean normalizedPct over the rows that carry one; null when none do. */
export function averagePct(grades: GradeRow[]): number | null {
  return meanOf(grades.map((g) => g.normalizedPct));
}

/**
 * Headline letter. The server's own average grade wins when present; otherwise the most
 * common letter among each subject's LATEST report (a tie goes to the more recent report).
 */
export function overallGrade(grades: GradeRow[], serverAverage?: string | null): string | null {
  const fromServer = (serverAverage ?? "").trim();
  if (fromServer) return fromServer;

  const latest = latestPerSubject(grades).filter((g) => g.grade.trim() !== "");
  if (latest.length === 0) return null;

  const tally = new Map<string, { count: number; newest: GradeRow }>();
  for (const row of latest) {
    const letter = row.grade.trim().toUpperCase();
    const entry = tally.get(letter);
    if (!entry) tally.set(letter, { count: 1, newest: row });
    else {
      entry.count += 1;
      if (isNewer(row, entry.newest)) entry.newest = row;
    }
  }
  let winner: { letter: string; count: number; newest: GradeRow } | null = null;
  for (const [letter, entry] of tally) {
    if (!winner || entry.count > winner.count || (entry.count === winner.count && isNewer(entry.newest, winner.newest))) {
      winner = { letter, count: entry.count, newest: entry.newest };
    }
  }
  return winner ? winner.letter : null;
}

export type SubjectGrade = { subject: string; grade: string };

export type GradeSummary = {
  overall: string | null;
  /** Real average score, or null (letters-only data). */
  averagePct: number | null;
  best: SubjectGrade | null;
  /** Subjects whose latest grade is in the low band. */
  attention: SubjectGrade[];
  reportCount: number;
  subjectCount: number;
};

export function summarizeGrades(grades: GradeRow[], serverAverage?: string | null): GradeSummary {
  const latest = latestPerSubject(grades);
  let best: SubjectGrade | null = null;
  let bestRank = Number.NEGATIVE_INFINITY;
  const attention: SubjectGrade[] = [];
  for (const row of latest) {
    const rank = gradeRank(row.grade);
    if (rank !== null && rank > bestRank) {
      bestRank = rank;
      best = { subject: row.subject, grade: row.grade };
    }
    if (gradeBand(row.grade) === "low") attention.push({ subject: row.subject, grade: row.grade });
  }
  return {
    overall: overallGrade(grades, serverAverage),
    averagePct: averagePct(grades),
    best,
    attention,
    reportCount: grades.length,
    subjectCount: latest.length,
  };
}

export type GradeMix = Record<GradeBand, number>;

/** How many reports fall in each band. */
export function gradeMix(grades: GradeRow[]): GradeMix {
  const mix: GradeMix = { top: 0, fair: 0, low: 0, unknown: 0 };
  for (const g of grades) mix[gradeBand(g.grade)] += 1;
  return mix;
}

/** Distinct terms in chronological order (by first report date when all have one, else by name). */
export function termsOf(grades: GradeRow[]): string[] {
  const first = new Map<string, number>();
  for (const g of grades) {
    const t = timeOf(g);
    const prev = first.get(g.term);
    if (prev === undefined || t < prev) first.set(g.term, t);
  }
  const terms = Array.from(first.keys());
  const allDated = terms.every((t) => Number.isFinite(first.get(t)));
  return terms.sort((a, b) => (allDated ? (first.get(a) as number) - (first.get(b) as number) : compareTerms(a, b)));
}

/** Average score per term, ONLY from real percentages; null unless at least two terms have one. */
export function scoreTrend(grades: GradeRow[]): { categories: string[]; data: number[] } | null {
  const categories: string[] = [];
  const data: number[] = [];
  for (const term of termsOf(grades)) {
    const avg = averagePct(grades.filter((g) => g.term === term));
    if (avg !== null) {
      categories.push(term);
      data.push(avg);
    }
  }
  return data.length >= 2 ? { categories, data } : null;
}

export type Trend = "up" | "down" | "steady";

/** Direction of the last two ranked reports of ONE subject; null with fewer than two. */
export function subjectTrend(rowsOfOneSubject: GradeRow[]): Trend | null {
  const ranked = sortOldestFirst(rowsOfOneSubject)
    .map((r) => gradeRank(r.grade))
    .filter((r): r is number => r !== null);
  if (ranked.length < 2) return null;
  const diff = ranked[ranked.length - 1] - ranked[ranked.length - 2];
  if (diff > 0.2) return "up";
  if (diff < -0.2) return "down";
  return "steady";
}

// ---- Subject cards -----------------------------------------------------------
export type SubjectCard = {
  key: string;
  name: string;
  teacherName: string | null;
  latestGrade: string | null;
  /** Real average score for the subject, or null. */
  averagePct: number | null;
  trend: Trend | null;
  reportCount: number;
};

/**
 * One card per subject: the student's enrolled subjects first (with teacher), then any
 * subject that only appears in the grade reports. Missing pieces stay null.
 */
export function buildSubjectCards(subjects: SubjectSummary[], grades: GradeRow[]): SubjectCard[] {
  const byName = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const key = subjectKey(g.subject);
    const list = byName.get(key) ?? [];
    list.push(g);
    byName.set(key, list);
  }

  const cards: SubjectCard[] = [];
  const seen = new Set<string>();
  const push = (name: string, teacherName: string | null, summary: SubjectSummary | null) => {
    const key = subjectKey(name);
    if (seen.has(key)) return;
    seen.add(key);
    const rows = byName.get(key) ?? [];
    const newest = rows.length > 0 ? sortNewestFirst(rows)[0] : null;
    cards.push({
      key,
      name,
      teacherName,
      latestGrade: summary?.latestGrade ?? newest?.grade ?? null,
      averagePct: summary?.averagePct ?? averagePct(rows),
      trend: subjectTrend(rows),
      reportCount: rows.length,
    });
  };

  for (const s of subjects) push(s.name, s.teacherName, s);
  const extras = Array.from(byName.values())
    .map((rows) => rows[0].subject)
    .sort((a, b) => a.localeCompare(b));
  for (const name of extras) push(name, null, null);
  return cards;
}

// ---- Attendance --------------------------------------------------------------
/** Any attendance rows at all? `total` 0 means "nothing recorded yet" (never show 0%). */
export function hasAttendance(a: AttendanceSummary | null | undefined): a is AttendanceSummary {
  return Boolean(a) && (a as AttendanceSummary).total > 0;
}

/** % present (+late) of total, whole number; null when nothing is recorded. */
export function computeAttendanceRate(present: number, late: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(((present + late) / total) * 100);
}

/** The rate a page may show: null when nothing is recorded. */
export function attendanceRate(a: AttendanceSummary | null | undefined): number | null {
  if (!hasAttendance(a)) return null;
  return Number.isFinite(a.rate) ? a.rate : computeAttendanceRate(a.present, a.late, a.total);
}

export type AttendanceTone = "success" | "warning" | "danger";

/** 90+ success, 75+ warning, below danger. */
export function attendanceTone(rate: number): AttendanceTone {
  if (rate >= 90) return "success";
  if (rate >= 75) return "warning";
  return "danger";
}

/** count / total as a whole percent (0 when total is 0). */
export function share(count: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

// ---- People / text -----------------------------------------------------------
export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Unnamed student";
}

/** First name for greetings; falls back to the last name, then "". */
export function greetingName(first: string | null | undefined, last?: string | null): string {
  return (first ?? "").trim().split(/\s+/)[0] || (last ?? "").trim().split(/\s+/)[0] || "";
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "82%" from a real number; "-" when missing. */
export function formatPct(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "-" : `${Math.round(value)}%`;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" });

/** "12 Mar 2026" from an ISO timestamp; "" when missing or invalid. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : SHORT_DATE.format(new Date(ms));
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "12 March 2012" from a yyyy-mm-dd or ISO timestamp; "" when missing or invalid. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "" : LONG_DATE.format(new Date(ms));
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Student status -> Badge tone. Unknown statuses stay neutral. */
export function statusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case "active":
      return "active";
    case "pending":
    case "admitted":
      return "pending";
    case "suspended":
    case "expelled":
    case "inactive":
      return "suspended";
    case "graduated":
    case "transferred":
      return "info";
    default:
      return "neutral";
  }
}
