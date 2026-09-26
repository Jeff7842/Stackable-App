"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { StudentDashboardData } from "@/lib/repositories/student.repo";

type GradesList = StudentDashboardData["grades"];
type ApiResponse = { ok: true; data: GradesList };

export function useStudentGrades() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: qk.students.list(),
    queryFn: ({ signal }) =>
      apiGet<ApiResponse>("/api/student/grades", signal).then((res) => res.data),
  });

  return { data, isLoading, isError, error };
}
