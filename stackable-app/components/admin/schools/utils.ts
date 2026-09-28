/**
 * Pure helpers for the Schools page: labels, formatting, capacity maths and the
 * filter / sort rules (identical to the ones the old page used).
 * No React in here, so both the table and the grid can share it.
 */
import type { SortingState } from "@tanstack/react-table";
import type { SchoolRow, SchoolStatus, SubscriptionStatus } from "@/hooks/useSchools";

/* --------------------------------------------------------------- options --- */

export const PACKAGES = ["Seedling", "Branch", "Canopy", "Forest"] as const;

export const SCHOOL_STATUS_OPTIONS: { value: SchoolStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

export const SUBSCRIPTION_STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "inactive", label: "Inactive" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" },
  { value: "trial", label: "Trial" },
];

/** The six capacity meters, in the order the old page listed them. */
export const CAPACITY_FIELDS = [
  { id: "users", label: "Users", actual: "no_of_users", expected: "expected_users" },
  { id: "students", label: "Students", actual: "no_of_students", expected: "expected_students" },
  { id: "parents", label: "Parents", actual: "no_of_parents", expected: "expected_parents" },
  { id: "teachers", label: "Teachers", actual: "no_of_teachers", expected: "expected_teachers" },
  { id: "admins", label: "Admins", actual: "no_of_admins", expected: "expected_admins" },
  { id: "staff", label: "Staff", actual: "no_of_staff", expected: "expected_staff" },
] as const satisfies readonly {
  id: string;
  label: string;
  actual: keyof SchoolRow;
  expected: keyof SchoolRow;
}[];

/** Regenerating the school code is capped at three times by the server. */
export const MAX_CODE_CHANGES = 3;

/* ------------------------------------------------------------ formatting --- */

/** "05 Mar 2026", or an em dash when empty / invalid (same output as the old page). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** `<input type="date">` wants YYYY-MM-DD. */
export function toDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

/**
 * Whole days from today until `value` (negative = already past). Null when the
 * date is missing or invalid. Kept here, not in a component, because it reads
 * the clock.
 */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

/** Short human hint for a subscription expiry, or null when nothing needs saying. */
export function expiryHint(value: string | null | undefined): { text: string; tone: "warning" | "danger" } | null {
  const days = daysUntil(value);
  if (days === null) return null;
  if (days < 0) return { text: `Expired ${Math.abs(days)}d ago`, tone: "danger" };
  if (days <= 30) return { text: days === 0 ? "Expires today" : `Expires in ${days}d`, tone: "warning" };
  return null;
}

/* -------------------------------------------------------------- capacity --- */

export type CapacityLevel = "none" | "good" | "steady" | "high" | "critical";

/** Percent used, 0 when no capacity is defined. */
export function capacityPercent(actual: number, expected: number): number {
  if (!expected || expected <= 0) return 0;
  return (actual / expected) * 100;
}

/**
 * The old page's thresholds: <=50 good, <=70 steady, <=90 high, above 90
 * critical (that one also shows a warning icon).
 */
export function capacityLevel(actual: number, expected: number): CapacityLevel {
  if (!expected || expected <= 0) return "none";
  const pct = capacityPercent(actual, expected);
  if (pct <= 50) return "good";
  if (pct <= 70) return "steady";
  if (pct <= 90) return "high";
  return "critical";
}

/* ------------------------------------------------------ filter and sort --- */

export type SchoolFilters = {
  search: string;
  status: "all" | SchoolStatus;
  subscription: "all" | SubscriptionStatus;
  pkg: string; // "all" or a package name
};

export const EMPTY_FILTERS: SchoolFilters = { search: "", status: "all", subscription: "all", pkg: "all" };

export function hasActiveFilters(filters: SchoolFilters): boolean {
  return Boolean(filters.search.trim()) || filters.status !== "all" || filters.subscription !== "all" || filters.pkg !== "all";
}

/** Search hits name, code, email, phone, head and owner (as before). */
export function filterSchools(schools: SchoolRow[], filters: SchoolFilters): SchoolRow[] {
  const q = filters.search.trim().toLowerCase();
  return schools.filter((school) => {
    const matchesSearch =
      !q ||
      school.name.toLowerCase().includes(q) ||
      school.code.toLowerCase().includes(q) ||
      (school.email ?? "").toLowerCase().includes(q) ||
      (school.phone_1 ?? "").toLowerCase().includes(q) ||
      (school.head_name ?? "").toLowerCase().includes(q) ||
      (school.owner_name ?? "").toLowerCase().includes(q);
    return (
      matchesSearch &&
      (filters.status === "all" || school.status === filters.status) &&
      (filters.subscription === "all" || school.subscription_status === filters.subscription) &&
      (filters.pkg === "all" || school.subscription_package === filters.pkg)
    );
  });
}

/** The sortable columns (ids match the DataTable column ids). */
export type SortColumn = "name" | "users" | "expiry";

/** "Sort by" choices from the old page, expressed as a TanStack sorting state. */
export const SORT_OPTIONS: { value: string; label: string; sorting: SortingState }[] = [
  { value: "name-asc", label: "Name A–Z", sorting: [{ id: "name", desc: false }] },
  { value: "name-desc", label: "Name Z–A", sorting: [{ id: "name", desc: true }] },
  { value: "users-high", label: "Users high", sorting: [{ id: "users", desc: true }] },
  { value: "users-low", label: "Users low", sorting: [{ id: "users", desc: false }] },
  { value: "expiry-asc", label: "Expiry nearest", sorting: [{ id: "expiry", desc: false }] },
  { value: "expiry-desc", label: "Expiry farthest", sorting: [{ id: "expiry", desc: true }] },
];

export const DEFAULT_SORTING: SortingState = SORT_OPTIONS[0].sorting;

/** Which "Sort by" option a sorting state corresponds to ("" when it matches none). */
export function sortingToOption(sorting: SortingState): string {
  const first = sorting[0];
  if (!first) return "";
  return SORT_OPTIONS.find((o) => o.sorting[0].id === first.id && o.sorting[0].desc === first.desc)?.value ?? "";
}

/** Value each sortable column compares on. Missing expiry sorts as "" (first when ascending), like before. */
export function sortValue(school: SchoolRow, column: string): string | number {
  switch (column) {
    case "name":
      return school.name;
    case "users":
      return school.no_of_users;
    case "expiry":
      return school.subscription_expires_at ?? "";
    default:
      return 0;
  }
}

/** Sorts a copy of the list (used by the grid; the table sorts through TanStack). */
export function sortSchools(schools: SchoolRow[], sorting: SortingState): SchoolRow[] {
  const first = sorting[0];
  if (!first) return schools;
  const dir = first.desc ? -1 : 1;
  return [...schools].sort((a, b) => {
    const av = sortValue(a, first.id);
    const bv = sortValue(b, first.id);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}
