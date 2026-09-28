// =============================================================================
// useDevUsers - GET /api/dev/users?q=&role=&schoolId=&status=&page=&pageSize=
// Users across EVERY school (super-admin only; the server enforces it).
// =============================================================================

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { DevPage, DevUserRow } from "@/lib/dev-types";
import { compactFilters, devGet, devQueryString, devRetry } from "./useDevShared";

export type DevUserFilters = {
  q?: string;
  role?: string;
  schoolId?: string;
  status?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
};

export function useDevUsers(filters: DevUserFilters = {}) {
  const active = compactFilters(filters);
  return useQuery<DevPage<DevUserRow>, HttpError>({
    queryKey: qk.dev.users(active),
    queryFn: ({ signal }) =>
      devGet<DevPage<DevUserRow>>(`/api/dev/users${devQueryString(active)}`, signal, "users"),
    placeholderData: keepPreviousData,
    retry: devRetry,
  });
}
