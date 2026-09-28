// =============================================================================
// useDevSchools - GET /api/dev/schools?q=&page=&pageSize= (server-side paging).
// =============================================================================

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { DevPage, DevSchoolRow } from "@/lib/dev-types";
import { compactFilters, devGet, devQueryString, devRetry } from "./useDevShared";

export type DevSchoolFilters = {
  q?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
};

/** The previous page stays visible while the next one loads (no table flash). */
export function useDevSchools(filters: DevSchoolFilters = {}) {
  const active = compactFilters(filters);
  return useQuery<DevPage<DevSchoolRow>, HttpError>({
    queryKey: qk.dev.schools(active),
    queryFn: ({ signal }) =>
      devGet<DevPage<DevSchoolRow>>(`/api/dev/schools${devQueryString(active)}`, signal, "schools"),
    placeholderData: keepPreviousData,
    retry: devRetry,
  });
}
