// =============================================================================
// Admin overview helpers - pure formatting + one tiny clock hook. No colours
// here: only tones / token class names.
// =============================================================================

import { useSyncExternalStore } from "react";
import type { BadgeTone } from "@/components/ui";

// School clock: Africa/Nairobi is UTC+3 all year (no daylight saving).
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

function subscribeClock(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
}
const minuteSnapshot = () => Math.floor(Date.now() / 60_000);
/** 0 on the server / during hydration: callers treat 0 as "time unknown". */
const serverSnapshot = () => 0;

/** Whole minutes since the epoch, re-rendered about once a minute (keeps Date.now() out of render). */
export function useEpochMinute(): number {
  return useSyncExternalStore(subscribeClock, minuteSnapshot, serverSnapshot);
}

export function greetingFor(epochMinute: number): string {
  if (!epochMinute) return "Welcome back";
  const hour = new Date(epochMinute * 60_000 + NAIROBI_OFFSET_MS).getUTCHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "Saturday, 26 September" for the school's current day. */
export function formatToday(epochMinute: number): string {
  return epochMinute ? LONG_DATE.format(new Date(epochMinute * 60_000 + NAIROBI_OFFSET_MS)) : "";
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

const TREND_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });

/** "Mon 22" from a yyyy-mm-dd string (chart axis label). Falls back to the raw text. */
export function trendLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return TREND_DAY.format(new Date(`${date}T00:00:00Z`));
}

export function formatPct(value: number | null | undefined, decimals = 0): string {
  return value == null || Number.isNaN(value) ? "-" : `${value.toFixed(decimals)}%`;
}

export function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
