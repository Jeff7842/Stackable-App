// =============================================================================
// useDevOverview - GET /api/dev/overview (counts, service health, platform facts).
// -----------------------------------------------------------------------------
// The server caches this for ~30s, so we poll on the same beat: the console feels
// live without hammering the probes. Polling stops on 401/403 (nothing to gain),
// pauses while the tab is hidden, and the previous numbers stay on screen while a
// refresh is in flight (keepPreviousData) so the KPI cards never blank out.
// =============================================================================

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { DevOverview } from "@/lib/dev-types";
import { devGet, devRetry } from "./useDevShared";

export const OVERVIEW_POLL_MS = 30_000;

export function useDevOverview() {
  return useQuery<DevOverview, HttpError>({
    queryKey: qk.dev.overview(),
    queryFn: ({ signal }) => devGet<DevOverview>("/api/dev/overview", signal, "overview"),
    refetchInterval: (query) => {
      const error = query.state.error;
      const blocked = error instanceof HttpError && (error.status === 401 || error.status === 403);
      return blocked ? false : OVERVIEW_POLL_MS;
    },
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    retry: devRetry,
  });
}
