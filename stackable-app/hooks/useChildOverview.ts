"use client";
import { useQuery } from "@tanstack/react-query";
import { HttpError, apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { ChildOverview } from "@/lib/repositories/parent.repo";

type ApiResponse = { ok: true; data: ChildOverview };

export function useChildOverview(studentId: string | undefined) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: qk.parent.child(studentId ?? ""),
    queryFn: async ({ signal }) => {
      try {
        const res = await apiGet<ApiResponse>(
          `/api/parent/children/${studentId}`,
          signal,
        );
        return res.data;
      } catch (err) {
        // Surface the 403 case as a typed sentinel so the page can show
        // a permission-denied state rather than a generic error card.
        if (err instanceof HttpError && err.status === 403) {
          throw new Error("NOT_YOUR_CHILD");
        }
        throw err;
      }
    },
    staleTime: 30_000,
    enabled: !!studentId,
  });

  return { data, isLoading, isError, error };
}
