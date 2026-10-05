import type { AllowanceTier } from "./policy";

export type AllowanceStatus = "AVAILABLE" | "EXHAUSTED";

export interface Allowance {
  status: AllowanceStatus;
  limit: number;
  remaining: number;
}

export const EAST_AFRICA_UTC_OFFSET_MINUTES = 180; // schools reset the allowance at local midnight
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Daily request limit: the highest tier whose min points the student has reached, else the base. */
export function dailyLimit(points: number, tiers: readonly AllowanceTier[], base: number): number {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  let limit = base;
  for (const tier of sorted) if (points >= tier.minPoints) limit = tier.dailyRequests;
  return limit;
}

/** The school-local day containing `now`, as UTC instants [from, to). */
export function dayWindow(now: Date, offsetMinutes = EAST_AFRICA_UTC_OFFSET_MINUTES): { from: Date; to: Date } {
  const shifted = now.getTime() + offsetMinutes * MS_PER_MINUTE;
  const startLocal = Math.floor(shifted / MS_PER_DAY) * MS_PER_DAY;
  const from = new Date(startLocal - offsetMinutes * MS_PER_MINUTE);
  return { from, to: new Date(from.getTime() + MS_PER_DAY) };
}

/** AVAILABLE while today's used requests are below the limit. */
export function allowanceStatus(limit: number, usedToday: number): Allowance {
  const remaining = Math.max(0, limit - usedToday);
  return { status: remaining > 0 ? "AVAILABLE" : "EXHAUSTED", limit, remaining };
}
