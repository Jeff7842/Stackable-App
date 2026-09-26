// =============================================================================
// useTeachers — fetches the full teacher list from GET /api/teachers.
// -----------------------------------------------------------------------------
// Returns TanStack Query state (data, isLoading, error) so components can
// react to loading/error states without managing their own fetch lifecycle.
// Data is kept fresh for 30 s; re-fetches on window focus to catch changes
// made in other tabs (e.g. after adding or editing a teacher).
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";

/** Shape of a single teacher record returned by GET /api/teachers. */
export type TeacherListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  subject_id: number | null;
  school_id: string;
  profile_photo: string | null;
  status: string;
  created_at: string | null;
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: number | null;
  class_teacher: boolean | null;
  school_name: string | null;
  subject_name: string | null;
  class_labels: string[];
};

type TeachersResponse = { ok: boolean; data: TeacherListItem[] };

/**
 * Fetches all teachers from the API and caches the result for 30 seconds.
 *
 * Returns standard TanStack Query fields: data, isLoading, isError, error,
 * and refetch. The data shape is `{ ok: true, data: TeacherListItem[] }`.
 *
 * Why: centralises the teacher list fetch so every page/component uses the
 * same cache key and avoids duplicate network requests.
 */
export function useTeachers() {
  return useQuery({
    queryKey: qk.teachers.list(),
    queryFn: ({ signal }) => apiGet<TeachersResponse>("/api/teachers", signal),
    staleTime: 30_000, // 30 s — fresh enough for a live dashboard
    refetchOnWindowFocus: true,
  });
}
