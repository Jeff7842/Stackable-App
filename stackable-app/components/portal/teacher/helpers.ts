// =============================================================================
// Teacher portal helpers - pure formatting + one tiny clock hook.
// Only tokens/tones are decided here (no colour values); components map a tone
// to a token utility class.
// =============================================================================

import { useSyncExternalStore } from "react";
import type { BadgeTone } from "@/components/ui";
import type { LessonSlot } from "@/lib/repositories/portal-types";

// ---- Clock -----------------------------------------------------------------
// The school runs on Africa/Nairobi, which is UTC+3 all year (no daylight
// saving), so a fixed offset is exact and avoids Intl timezone edge cases.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

function subscribeClock(onChange: () => void): () => void {
  // 30 s tick: the minute-level snapshot below only changes once a minute.
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);
/** 0 on the server and during hydration: callers treat 0 as "time unknown". */
const serverSnapshot = () => 0;

/**
 * Current time as whole minutes since the epoch, re-rendered about once a minute.
 * useSyncExternalStore keeps SSR/hydration consistent and keeps Date.now() out of render.
 */
export function useEpochMinute(): number {
  return useSyncExternalStore(subscribeClock, minuteSnapshot, serverSnapshot);
}

/** Minutes since midnight in Nairobi for an epoch-minute value. */
export function nairobiMinuteOfDay(epochMinute: number): number {
  const d = new Date(epochMinute * 60_000 + NAIROBI_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function greetingFor(epochMinute: number): string {
  if (!epochMinute) return "Welcome back";
  const hour = Math.floor(nairobiMinuteOfDay(epochMinute) / 60);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "08:30" -> 510. Returns null for anything that is not HH:mm. */
export function hhmmToMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Saturday, 26 September" from a yyyy-mm-dd string, else from the clock. */
export function formatLongDate(isoDate: string | undefined, epochMinute: number): string {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));
  }
  if (epochMinute) return LONG_DATE.format(new Date(epochMinute * 60_000 + NAIROBI_OFFSET_MS));
  return "";
}

const DOB_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** "12 March 2012" from a yyyy-mm-dd or ISO timestamp; "-" when missing or invalid. */
export function formatDob(value: string | null | undefined): string {
  if (!value) return "-";
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "-" : DOB_DATE.format(new Date(ms));
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Nairobi" });

/** "5m ago", "3h ago", "2d ago", then a short date. Empty when the input is unusable. */
export function timeAgo(iso: string | null | undefined, epochMinute: number): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  if (!epochMinute) return SHORT_DATE.format(new Date(then));
  const minutes = Math.max(0, epochMinute - Math.floor(then / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return SHORT_DATE.format(new Date(then));
}

// ---- Lessons -----------------------------------------------------------------
export type LessonPhase = "now" | "upcoming" | "done" | "unknown";

/** Where a slot sits relative to `nowMin` (minutes since midnight, Nairobi). null = clock not ready. */
export function lessonPhase(slot: LessonSlot, nowMin: number | null): LessonPhase {
  const start = hhmmToMinutes(slot.startTime);
  const end = hhmmToMinutes(slot.endTime);
  if (nowMin == null || start == null) return "unknown";
  if (nowMin < start) return "upcoming";
  if (end == null || nowMin < end) return "now";
  return "done";
}

/** Lessons show their subject; breaks / assemblies (itemType other than lesson) show their title. */
export function isBreakSlot(slot: LessonSlot): boolean {
  return Boolean(slot.itemType) && !/^(lesson|class|period|subject)$/i.test(slot.itemType ?? "");
}

export function lessonTitle(slot: LessonSlot): string {
  if (isBreakSlot(slot)) return slot.title ?? capitalize(slot.itemType ?? "Break");
  return slot.subjectName ?? slot.title ?? "Lesson";
}

// ---- People / numbers --------------------------------------------------------
export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(" ").trim() || "Unnamed student";
}

export function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function formatPct(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "-" : `${Math.round(value)}%`;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ---- Tones -----------------------------------------------------------------
/** Grade chip tone from a 0-100 score. */
export function gradeTone(pct: number | null | undefined): BadgeTone {
  if (pct == null) return "neutral";
  if (pct >= 75) return "success";
  if (pct >= 50) return "info";
  return "warning";
}

/** Fill class for a tiny score bar (token utilities only). */
export function scoreBar(pct: number | null | undefined): string {
  if (pct == null) return "bg-muted";
  if (pct >= 75) return "bg-success";
  if (pct >= 50) return "bg-primary";
  return "bg-warning";
}

/** Dot class for an attendance rate: green 90+, amber 75+, red below. */
export function attendanceDot(rate: number | null | undefined): string {
  if (rate == null) return "bg-muted";
  if (rate >= 90) return "bg-success";
  if (rate >= 75) return "bg-warning";
  return "bg-danger";
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

export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
