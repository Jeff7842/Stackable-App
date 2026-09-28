// =============================================================================
// Normalisers shared by the Prisma repositories and their mappers.
// -----------------------------------------------------------------------------
// Prisma hands back Date / BigInt / Decimal, but the API must return plain strings and
// numbers. Both backends run their rows through these so the API returns the
// SAME JSON either way (and a cache HIT, which is JSON, looks like a MISS).
// =============================================================================

/** ISO-8601 UTC string ("2026-01-05T10:00:00.000Z") for a Date or any date string; null if unusable. */
export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "YYYY-MM-DD" for a DATE column (a Date at UTC midnight from Prisma, or an already-plain string). */
export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

/** A Date at UTC midnight for a "YYYY-MM-DD" string (what a Postgres DATE column expects from Prisma). */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** A Date on 1970-01-01 for an "HH:MM" string (what a Postgres TIME column expects from Prisma). */
export function timeToDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

/** Number from a BigInt, Decimal, numeric string or number; null when missing or not finite. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "First Last" trimmed, or "Unnamed student" when both are blank (same fallback as the old pages). */
export function studentFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return full || "Unnamed student";
}

/**
 * "Grade 7 A" style label. The old pages used "Unassigned" (teachers) and "—"
 * (students) for a missing class, so this returns null and each caller picks.
 */
export function classLabelOrNull(
  classItem: { class_name: string; stream: string | null } | null | undefined,
): string | null {
  if (!classItem) return null;
  return classItem.stream ? `${classItem.class_name} ${classItem.stream}` : classItem.class_name;
}

/** Sort classes A-Z by name then stream, numbers inside names compared numerically ("Grade 2" < "Grade 10"). */
export function compareClasses(
  a: { class_name: string; stream: string | null },
  b: { class_name: string; stream: string | null },
): number {
  const byName = a.class_name.localeCompare(b.class_name, undefined, { numeric: true });
  if (byName !== 0) return byName;
  return (a.stream ?? "").localeCompare(b.stream ?? "", undefined, { numeric: true });
}
