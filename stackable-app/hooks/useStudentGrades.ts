// =============================================================================
// useStudentGrades - the signed-in student's grade reports (GET /api/student/grades).
// -----------------------------------------------------------------------------
// Response: { ok: true, data: GradeRow[] }. Normalised so a missing field is null,
// never undefined. Letters are the norm today: normalizedPct / rawScore are usually
// null and the UI must not turn that into 0.
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import { normalizeGrades } from "@/components/portal/student/normalize";

export function useStudentGrades() {
  return useQuery({
    queryKey: qk.studentPortal.grades(),
    queryFn: ({ signal }) =>
      apiGet<{ ok: true; data: unknown }>("/api/student/grades", signal).then((res) => normalizeGrades(res.data)),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
