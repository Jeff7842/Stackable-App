// =============================================================================
// Presentation helpers for the developer console: names, role / status labels
// and tones, dates. Pure functions. Colours are Badge tones (design tokens), never
// hex values.
// =============================================================================

import type { BadgeTone } from "@/components/ui";
import type { Role } from "@/lib/validation/shared";

/** "super-admin" -> "Super admin", "past_due" -> "Past due". */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "-";
  const spaced = value.replace(/[-_.]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fullName(person: { firstName?: string | null; lastName?: string | null }): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || "Unnamed user";
}

/**
 * Exhaustive on purpose: adding a Role in lib/validation/shared.ts makes this
 * fail to compile until the label is added. Also the source of the role filter options.
 */
export const ROLE_LABEL: Record<Role, string> = {
  "super-admin": "Super admin",
  admin: "Admin",
  manager: "Manager",
  teacher: "Teacher",
  staff: "Staff",
  student: "Student",
  pupil: "Pupil",
  parent: "Parent",
};

export const ROLE_OPTIONS = Object.keys(ROLE_LABEL) as Role[];

export function roleLabel(role: string): string {
  return (ROLE_LABEL as Record<string, string>)[role] ?? titleCase(role);
}

const ROLE_TONE: Record<Role, BadgeTone> = {
  "super-admin": "gold",
  admin: "info",
  manager: "info",
  teacher: "success",
  staff: "neutral",
  student: "neutral",
  pupil: "neutral",
  parent: "warning",
};

export function roleTone(role: string): BadgeTone {
  return (ROLE_TONE as Record<string, BadgeTone>)[role] ?? "neutral";
}

export const USER_STATUS_OPTIONS = ["active", "suspended", "pending"] as const;

/** Works for user status, school status and subscription status (all free-form strings). */
export function statusTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "paid":
      return "active";
    case "suspended":
    case "inactive":
    case "expired":
    case "cancelled":
    case "canceled":
      return "suspended";
    case "pending":
    case "trial":
    case "trialing":
      return "pending";
    default:
      return "neutral";
  }
}

// ---------------------------------------------------------------------------
// Audit actions
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<string, string> = {
  "impersonation.start": "Started viewing",
  "impersonation.stop": "Stopped viewing",
  "impersonation.request": "Request while viewing",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? titleCase(action);
}

export function actionTone(action: string): BadgeTone {
  if (action === "impersonation.start") return "gold";
  if (action === "impersonation.request") return "info";
  if (action === "impersonation.stop") return "neutral";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Dates. Only ever rendered from client-fetched data, so the browser locale /
// timezone is safe (no server/client mismatch).
// ---------------------------------------------------------------------------

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_ONLY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_TIME.format(date) : "-";
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? DATE_ONLY.format(date) : "-";
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then a plain date. `now` is epoch ms (see useNow). */
export function formatRelative(iso: string | null | undefined, now: number): string {
  const date = parse(iso);
  if (!date) return "-";
  if (!now) return formatDate(iso);
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

export function formatMs(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? "-" : `${Math.round(ms)} ms`;
}

export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
