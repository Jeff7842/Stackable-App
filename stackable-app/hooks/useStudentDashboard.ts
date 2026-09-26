"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { StudentDashboardData } from "@/lib/repositories/student.repo";

type ApiResponse = { ok: true; data: StudentDashboardData };

export function useStudentDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: qk.students.detail("dashboard"),
    queryFn: ({ signal }) =>
      apiGet<ApiResponse>("/api/student/dashboard", signal).then((res) => res.data),
  });

  return { data, isLoading, isError, error };
}
