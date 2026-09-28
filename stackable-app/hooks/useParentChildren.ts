// =============================================================================
// useParentChildren - the children linked to the signed-in parent
// (GET /api/parent/children -> { ok: true, data: ChildCard[] }).
// Normalised: cards without an id are dropped, averages / attendance stay null
// when the school has not recorded them (never 0).
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import { normalizeChildCards } from "@/components/portal/student/normalize";

export function useParentChildren() {
  return useQuery({
    queryKey: qk.parent.children(),
    queryFn: ({ signal }) =>
      apiGet<{ ok: true; data: unknown }>("/api/parent/children", signal).then((res) =>
        normalizeChildCards(res.data),
      ),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
