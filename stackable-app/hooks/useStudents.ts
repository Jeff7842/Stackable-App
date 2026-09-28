// =============================================================================
// Student admin hooks — the /dashboard/students pages talk to the API only here.
// -----------------------------------------------------------------------------
// Replaces the direct browser-to-database reads/writes of the old pages.
// All endpoints are school-scoped from the session and need role admin, manager
// or super-admin. Every hook UNWRAPS the `{ ok: true, data }` envelope, so `data`
// below is the DTO itself (unlike the original useTeachers, which returns the envelope).
//
//   useStudents()            GET    /api/students                -> StudentListData
//   useStudent(id)           GET    /api/students/[id]           -> StudentProfile
//   useStudentFormOptions()  GET    /api/students/form-options   -> StudentFormOptions
//   useUpdateStudent()       PATCH  /api/students/[id]           -> StudentUpdateResult
//   useDeleteStudent()       DELETE /api/students/[id]           -> StudentDeleteResult
//
// Mutations invalidate qk.students.all (list, profile, form options), so lists and
// open profiles refresh themselves. Errors are HttpError (lib/api/http.ts) with the
// server's message, so `error.message` is safe to show in a toast.
// =============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type {
  StudentDeleteResult,
  StudentFormOptions,
  StudentListData,
  StudentProfile,
  StudentUpdateInput,
  StudentUpdateResult,
} from "@/lib/dto/students";

export type {
  StudentClassOption,
  StudentDeleteResult,
  StudentFormOptions,
  StudentGrade,
  StudentGuardian,
  StudentListData,
  StudentListItem,
  StudentProfile,
  StudentSchoolOption,
  StudentStatus,
  StudentStatusCounts,
  StudentSubject,
  StudentUpdateInput,
  StudentUpdateResult,
} from "@/lib/dto/students";
export { MAX_STUDENTS_PER_LIST, STUDENT_STATUSES } from "@/lib/dto/students";

type Envelope<T> = { ok: true; data: T };

/** Variables of useUpdateStudent(): which student, and the fields to change. */
export type UpdateStudentVariables = { id: string; changes: StudentUpdateInput };

/**
 * Every student of the caller's school (max 5000) with counts and the class filter list.
 * Filtering, sorting and paging are meant to happen client-side, as on the old page.
 * Fresh for 30 s; refetches on window focus.
 */
export function useStudents() {
  return useQuery({
    queryKey: qk.students.list(),
    queryFn: ({ signal }) =>
      apiGet<Envelope<StudentListData>>("/api/students", signal).then((res) => res.data),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Full profile of one student. Pass undefined while the id is not known yet (the query stays idle). */
export function useStudent(id: string | undefined) {
  return useQuery({
    queryKey: qk.students.detail(id ?? ""),
    queryFn: ({ signal }) =>
      apiGet<Envelope<StudentProfile>>(`/api/students/${id}`, signal).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Classes / school / status list for filters and the edit form. Rarely changes: fresh for 5 minutes. */
export function useStudentFormOptions() {
  return useQuery({
    queryKey: qk.studentAdmin.formOptions(),
    queryFn: ({ signal }) =>
      apiGet<Envelope<StudentFormOptions>>("/api/students/form-options", signal).then((res) => res.data),
    staleTime: 300_000,
  });
}

/**
 * Change a student (status toggle, class move, contact details...). Only the keys
 * you send change. Resolves to the refreshed list row. 400 on invalid fields, 404
 * when the student is not in the caller's school.
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: UpdateStudentVariables) =>
      apiSend<Envelope<StudentUpdateResult>>("PATCH", `/api/students/${id}`, changes).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.students.all }),
  });
}

/**
 * Delete a student (id string). Removes the student record only (their login
 * account is kept, as before). The profile query for that id is dropped from the
 * cache so an open page does not refetch a 404.
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiSend<Envelope<StudentDeleteResult>>("DELETE", `/api/students/${id}`).then((res) => res.data),
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: qk.students.detail(result.id) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.students.all }),
        queryClient.invalidateQueries({ queryKey: qk.teachers.all }),
      ]);
    },
  });
}
