"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { ChildCard } from "@/lib/repositories/parent.repo";

type ApiResponse = { ok: true; data: ChildCard[] };

export function useParentChildren() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: qk.parent.children(),
    queryFn: ({ signal }) =>
      apiGet<ApiResponse>("/api/parent/children", signal).then((res) => res.data),
    staleTime: 30_000,
  });

  return { data, isLoading, isError, error };
}
