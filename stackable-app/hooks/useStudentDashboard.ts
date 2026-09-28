// =============================================================================
// useStudentDashboard - the student home data (GET /api/student/dashboard).
// -----------------------------------------------------------------------------
// Response = StudentDashboardData (lib/repositories/portal-types.ts), wrapped as
// { ok: true, data }. The response is run through normalizeStudentDashboard so
// the page always receives the full contract with safe defaults (an older
// backend, or null averages, never crash the UI).
//
// Feels live: refetches quietly every 60 s (only while the tab is visible) and
// when the window regains focus. A failed background refetch keeps the last good
// data in `query.data` (the page only shows an error when there is nothing to show).
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import { normalizeStudentDashboard } from "@/components/portal/student/normalize";

export type { StudentDashboardData } from "@/lib/repositories/portal-types";

const REFRESH_MS = 60_000;

export function useStudentDashboard() {
  return useQuery({
    queryKey: qk.studentPortal.dashboard(),
    queryFn: ({ signal }) =>
      apiGet<{ ok: true; data: unknown }>("/api/student/dashboard", signal).then((res) =>
        normalizeStudentDashboard(res.data),
      ),
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
