export interface BandInput {
  minPct: number;
  maxPct: number;
  grade: string;
  points: number;
  remark?: string | null;
}

export type BandIssueCode = "EMPTY" | "RANGE" | "START" | "END" | "GAP" | "OVERLAP";

export interface BandIssue {
  code: BandIssueCode;
  message: string;
  /** Indexes into the input array of the offending rows. */
  rows: number[];
}

const MAX_DECIMALS = 2;
const EPSILON = 1e-9;

// The grid is the finest decimal precision any bound uses, so whole-number bands (79 then 80) are contiguous.
function gridDecimals(bands: BandInput[]): number {
  for (let d = 0; d <= MAX_DECIMALS; d++) {
    const factor = 10 ** d;
    const onGrid = bands.every((b) => [b.minPct, b.maxPct].every((x) => Math.abs(x * factor - Math.round(x * factor)) < EPSILON));
    if (onGrid) return d;
  }
  return MAX_DECIMALS;
}

/** Checks that bands cover 0 to 100 with no gaps or overlaps and returns every offending row. */
export function validateBands(bands: BandInput[]): BandIssue[] {
  if (bands.length === 0) return [{ code: "EMPTY", message: "At least one band is required", rows: [] }];

  const issues: BandIssue[] = [];
  bands.forEach((b, i) => {
    const decimalsOk = Math.abs(b.minPct * 100 - Math.round(b.minPct * 100)) < EPSILON && Math.abs(b.maxPct * 100 - Math.round(b.maxPct * 100)) < EPSILON;
    if (!(b.minPct >= 0 && b.maxPct <= 100 && b.minPct <= b.maxPct && decimalsOk)) {
      issues.push({ code: "RANGE", message: "Band must satisfy 0 <= min <= max <= 100 with at most 2 decimals", rows: [i] });
    }
  });
  if (issues.length > 0) return issues;

  const factor = 10 ** gridDecimals(bands);
  const scaled = bands.map((b, i) => ({ i, min: Math.round(b.minPct * factor), max: Math.round(b.maxPct * factor) }));
  scaled.sort((a, b) => a.min - b.min || a.max - b.max);

  if (scaled[0].min !== 0) issues.push({ code: "START", message: "Bands must start at 0", rows: [scaled[0].i] });
  const last = scaled[scaled.length - 1];
  if (Math.max(...scaled.map((s) => s.max)) !== 100 * factor) {
    issues.push({ code: "END", message: "Bands must end at 100", rows: [last.i] });
  }

  let reach = scaled[0];
  for (const cur of scaled.slice(1)) {
    if (cur.min <= reach.max) issues.push({ code: "OVERLAP", message: "Bands overlap", rows: [reach.i, cur.i] });
    else if (cur.min > reach.max + 1) issues.push({ code: "GAP", message: "Gap between bands", rows: [reach.i, cur.i] });
    if (cur.max > reach.max) reach = cur;
  }
  return issues;
}

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Converts a raw score to a percentage rounded to 2 decimals. */
export function normalise(raw: number, total: number): number {
  if (!(total > 0)) throw new RangeError("total must be positive");
  if (!(raw >= 0 && raw <= total)) throw new RangeError("raw must be between 0 and total");
  return round2((raw / total) * 100);
}

/** Finds the band for a percentage, rounding it to the bands' own precision first (79.6 is 80 for whole bands). */
export function gradeFor<B extends BandInput>(pct: number, bands: B[]): B {
  if (!(pct >= 0 && pct <= 100)) throw new RangeError("pct must be between 0 and 100");
  const factor = 10 ** gridDecimals(bands);
  const p = Math.round(pct * factor + EPSILON);
  const hit = bands.find((b) => p >= Math.round(b.minPct * factor) && p <= Math.round(b.maxPct * factor));
  if (!hit) throw new Error(`bands do not cover ${pct}`);
  return hit;
}

export function isPass(pct: number, passPct: number): boolean {
  return pct >= passPct;
}
