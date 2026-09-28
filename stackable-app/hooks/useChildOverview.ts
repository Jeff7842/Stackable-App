// =============================================================================
// useChildOverview - one child's grades, attendance and subjects for a parent
// (GET /api/parent/children/[studentId] -> { ok: true, data: ChildOverview }).
// The server scopes it: a child that is not linked to the parent answers 403
// (a malformed id 400, a removed student 404). The HttpError is re-thrown as is,
// and `isChildAccessError` lets the page show a "not your child" state instead of
// a generic error with a Retry button that could never succeed.
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { HttpError, apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import { normalizeChildOverview } from "@/components/portal/student/normalize";

/** True for the responses that retrying will never fix (not linked / not found / bad id). */
export function isChildAccessError(error: unknown): boolean {
  return error instanceof HttpError && [400, 403, 404].includes(error.status);
}

export function useChildOverview(studentId: string | undefined) {
  return useQuery({
    queryKey: qk.parent.child(studentId ?? ""),
    queryFn: ({ signal }) =>
      apiGet<{ ok: true; data: unknown }>(`/api/parent/children/${studentId}`, signal).then((res) =>
        normalizeChildOverview(res.data),
      ),
    staleTime: 30_000,
    enabled: Boolean(studentId),
    refetchOnWindowFocus: true,
    // 400/403/404 are final answers; anything else gets one quiet retry.
    retry: (failureCount, error) => !isChildAccessError(error) && failureCount < 1,
  });
}
