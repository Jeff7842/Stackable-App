// =============================================================================
// useAdminOverview - the school overview (GET /api/admin/overview).
// -----------------------------------------------------------------------------
// Shared by /admin and /dashboard. Shape = AdminOverviewData in
// lib/repositories/portal-types.ts. `normalize` fills anything the backend does
// not send yet so the overview never crashes on a missing field.
//
// Feels live: refetches quietly every 60 s (only while the tab is visible) and
// every time the window regains focus (data older than 30 s).
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { AdminOverviewData } from "@/lib/repositories/portal-types";

export type { AdminOverviewData } from "@/lib/repositories/portal-types";

type OverviewResponse = {
  ok: true;
  data: Partial<AdminOverviewData>;
};

const REFRESH_MS = 60_000;

function normalize(raw: Partial<AdminOverviewData>): AdminOverviewData {
  return {
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    school: raw.school ?? { id: "", name: "" },
    totals: {
      students: raw.totals?.students ?? 0,
      teachers: raw.totals?.teachers ?? 0,
      classes: raw.totals?.classes ?? 0,
      subjects: raw.totals?.subjects ?? 0,
      parents: raw.totals?.parents ?? 0,
    },
    attendanceToday: {
      present: raw.attendanceToday?.present ?? 0,
      late: raw.attendanceToday?.late ?? 0,
      absent: raw.attendanceToday?.absent ?? 0,
      total: raw.attendanceToday?.total ?? 0,
      rate: raw.attendanceToday?.rate ?? null,
      source: raw.attendanceToday?.source ?? "none",
    },
    attendanceTrend: raw.attendanceTrend ?? [],
    classPerformance: raw.classPerformance ?? [],
    recentGrades: raw.recentGrades ?? [],
    recentActivity: raw.recentActivity ?? [],
  };
}

export function useAdminOverview() {
  return useQuery({
    queryKey: qk.admin.overview(),
    queryFn: ({ signal }) =>
      apiGet<OverviewResponse>("/api/admin/overview", signal).then((r) => normalize(r.data ?? {})),
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
