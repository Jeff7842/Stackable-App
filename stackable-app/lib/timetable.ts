// =============================================================================
// Timetable helpers — pure functions (no server imports, safe in the browser).
// -----------------------------------------------------------------------------
// Used by the API (validation, ordering, conflict warnings) and available to the
// UI so the weekly grid and the server agree on ordering and on what "overlap"
// means.
// =============================================================================

import {
  TIMETABLE_DAYS,
  type TimetableConflict,
} from "@/lib/dto/teachers";

const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/**
 * Turn any time-of-day representation into "HH:MM".
 *
 * Why it exists: Postgres TIME comes back as "08:00:00" from raw SQL and as a
 * 1970-01-01 Date from Prisma, while the UI's grid and <input type="time"> use
 * "08:00". One canonical form keeps both database paths returning the same JSON.
 *
 * @param value "8:00", "08:00", "08:00:00", "08:00:00.000000" or a Date (UTC time part is used)
 * @returns "HH:MM", or null when the value is not a valid time of day
 */
export function normalizeTime(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Minutes since midnight for an "HH:MM" string (0 when it cannot be parsed, like the old page). */
export function timeToMinutes(time: string | null | undefined): number {
  const normalized = normalizeTime(time);
  if (!normalized) return 0;
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Position of a day in the week (Monday = 0). Unknown days sort last. */
export function dayIndex(day: string | null | undefined): number {
  const index = TIMETABLE_DAYS.indexOf(
    String(day ?? "").trim().toLowerCase() as (typeof TIMETABLE_DAYS)[number],
  );
  return index === -1 ? 999 : index;
}

/** Sort slots Monday -> Sunday, then by start time. Returns a new array. */
export function sortTimetable<T extends { day_of_week: string | null; start_time: string | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const dayGap = dayIndex(a.day_of_week) - dayIndex(b.day_of_week);
    if (dayGap !== 0) return dayGap;
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
}

function titleCase(day: string): string {
  return day ? day.charAt(0).toUpperCase() + day.slice(1).toLowerCase() : "Unknown";
}

/**
 * Find slots of one teacher that overlap on the same day.
 *
 * Two slots overlap when each starts before the other ends (back-to-back slots,
 * 08:00-09:00 then 09:00-10:00, do NOT overlap). The old edit page let several
 * blocks share a cell, so this is reported as a warning and never rejects a save.
 *
 * @param slots slots with day_of_week / start_time / end_time; indexes in the result refer to this array
 * @returns one entry per overlapping pair, ordered by day then by the earlier index
 */
export function findTimetableConflicts(
  slots: ReadonlyArray<{ day_of_week: string; start_time: string; end_time: string }>,
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  for (let first = 0; first < slots.length; first += 1) {
    for (let second = first + 1; second < slots.length; second += 1) {
      const a = slots[first];
      const b = slots[second];
      if (String(a.day_of_week).toLowerCase() !== String(b.day_of_week).toLowerCase()) continue;

      const aStart = timeToMinutes(a.start_time);
      const aEnd = timeToMinutes(a.end_time);
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      if (aStart < bEnd && bStart < aEnd) {
        const day = titleCase(String(a.day_of_week).toLowerCase());
        conflicts.push({
          day_of_week: String(a.day_of_week).toLowerCase(),
          first_index: first,
          second_index: second,
          message: `${day}: ${a.start_time}-${a.end_time} overlaps ${b.start_time}-${b.end_time}.`,
        });
      }
    }
  }

  return conflicts.sort(
    (x, y) => dayIndex(x.day_of_week) - dayIndex(y.day_of_week) || x.first_index - y.first_index,
  );
}
