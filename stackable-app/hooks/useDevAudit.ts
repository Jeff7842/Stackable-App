// =============================================================================
// useDevAudit - GET /api/dev/audit?actor=&target=&action=&from=&to=&page=&pageSize=
// `action` is a PREFIX ("impersonation." matches every impersonation event).
// `from` / `to` are inclusive ISO dates (YYYY-MM-DD). When the audit table has not
// been installed the server answers 503 with a readable message; the UI shows it.
// =============================================================================

"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { DevAuditRow, DevPage } from "@/lib/dev-types";
import { compactFilters, devGet, devQueryString, devRetry } from "./useDevShared";

export type DevAuditFilters = {
  /** User id of the actor (the super-admin). */
  actor?: string;
  /** User id of the impersonated user. */
  target?: string;
  action?: string;
  from?: string;
  to?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
};

/** `enabled: false` lets a page hold the request back (for example an invalid date range). */
export function useDevAudit(filters: DevAuditFilters = {}, options: { enabled?: boolean } = {}) {
  const active = compactFilters(filters);
  return useQuery<DevPage<DevAuditRow>, HttpError>({
    queryKey: qk.dev.audit(active),
    queryFn: ({ signal }) =>
      devGet<DevPage<DevAuditRow>>(`/api/dev/audit${devQueryString(active)}`, signal, "audit"),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    retry: devRetry,
  });
}
