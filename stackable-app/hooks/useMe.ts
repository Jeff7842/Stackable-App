// =============================================================================
// useMe — who is signed in right now (GET /api/auth/me).
// -----------------------------------------------------------------------------
// The dashboard shell uses this for the navbar name, the role chip, the school
// name and (from wave 2) the "Viewing as ..." impersonation banner.
//
// Identity changes rarely, so we keep it fresh for 60 s and do NOT refetch every
// time the window regains focus (that would fire on every tab switch for data
// that almost never changes). After login, logout or impersonation start/stop,
// call queryClient.invalidateQueries({ queryKey: qk.me }) to refresh it.
// =============================================================================

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiGet, HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { Role } from "@/lib/validation/shared";

/** The signed-in user, exactly as returned by GET /api/auth/me. */
export type Me = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: Role;
  schoolId: string;
  schoolCode: string;
  schoolName?: string;
  /** Which dashboard family the role belongs to (ROLE_DASHBOARD[role]). */
  portal: string;
  /** Where the role lands after login (ROLE_HOME[role]). */
  home: string;
  /** Set only while a super-admin is impersonating this user; `expiresAt` is when that view ends (ISO). */
  impersonatedBy: null | { id: string; name: string; role: string; reason?: string; expiresAt?: string };
};

// A 401/403 will not fix itself by retrying, so fail fast and let the shell redirect.
const NO_RETRY_STATUSES = [401, 403];
const MAX_RETRIES = 1; // one retry for network blips, matching the app-wide default

/**
 * Fetches the current user. Returns standard TanStack Query state.
 *
 * Why: one shared cache entry (qk.me) so the navbar, role chip and impersonation
 * banner never each make their own request.
 */
export function useMe(): UseQueryResult<Me> {
  return useQuery<Me>({
    queryKey: qk.me,
    queryFn: ({ signal }) => apiGet<Me>("/api/auth/me", signal),
    staleTime: 60_000, // 60 s
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof HttpError && NO_RETRY_STATUSES.includes(error.status)) return false;
      return failureCount < MAX_RETRIES;
    },
  });
}
