// =============================================================================
// Shared helpers for the developer-console hooks (useDevOverview, useDevSchools,
// useDevUsers, useDevAudit). Not a hook itself; it lives here so the four data
// hooks stay tiny and behave the same way.
// -----------------------------------------------------------------------------
// Contract: every GET under /api/dev answers { ok: true, data: T } (see
// lib/dev-types.ts). `devGet` unwraps `data`, logs failures, and rethrows the
// HttpError untouched so the UI can show the SERVER's message (for example the
// 503 "Run db/foundation.sql ..." hint).
// =============================================================================

import { apiGet, HttpError } from "@/lib/api/http";

export type DevEnvelope<T> = { ok: true; data: T };

type FilterValue = string | number | null | undefined;

/**
 * Keep only the filters that are really set (non-empty), trimmed. Used both for
 * the URL and for the query key, so {q: ""} and {} share one cache entry.
 */
export function compactFilters(filters: Record<string, FilterValue>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
      continue;
    }
    const trimmed = value.trim();
    if (trimmed !== "") out[key] = trimmed;
  }
  return out;
}

/** "?a=1&b=2" (or "" when there is nothing to send). */
export function devQueryString(filters: Record<string, string | number>): string {
  const qs = new URLSearchParams(
    Object.entries(filters).map(([key, value]) => [key, String(value)] as [string, string]),
  ).toString();
  return qs ? `?${qs}` : "";
}

/** GET + unwrap the { ok, data } envelope. `label` only feeds the log line. */
export async function devGet<T>(url: string, signal: AbortSignal | undefined, label: string): Promise<T> {
  try {
    const res = await apiGet<DevEnvelope<T>>(url, signal);
    return res.data;
  } catch (error) {
    // Aborted requests (route change, new filter) are normal; do not log them as failures.
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.warn(`[dev] ${label} request failed`, error instanceof HttpError ? `${error.status} ${error.message}` : error);
    }
    throw error;
  }
}

// These will not fix themselves by retrying (bad input, not signed in, not allowed,
// missing, rate limited, setup SQL not applied), so surface them immediately.
const NO_RETRY_STATUSES = [400, 401, 403, 404, 429, 503];

/** One retry for network blips; none for the statuses above. */
export function devRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && NO_RETRY_STATUSES.includes(error.status)) return false;
  return failureCount < 1;
}
