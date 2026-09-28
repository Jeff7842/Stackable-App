// =============================================================================
// Teacher hooks — the /dashboard/teachers pages talk to the API only here.
// -----------------------------------------------------------------------------
// useTeachers() is the original hook and is unchanged (it returns the raw
// `{ ok, data }` envelope). Every NEW hook below UNWRAPS the envelope, so its
// `data` is the DTO itself.
//
//   useTeachers()             GET    /api/teachers                     -> { ok, data: TeacherListItem[] }
//   useTeacherFormOptions()   GET    /api/teachers/form-options        -> TeacherFormOptions
//   useTeacher(id)            GET    /api/teachers/[id]                -> TeacherProfileData (teacher + pupils)
//   useTeacherEditData(id)    GET    /api/teachers/[id]/edit-data      -> TeacherEditData
//   useTeacherTimetable(id)   GET    /api/teachers/[id]/timetable      -> TeacherTimetableData
//   useTeacherAttendance(id)  GET    /api/teachers/[id]/attendance     -> TeacherAttendanceData
//   useCreateTeacher()        POST   /api/teachers (multipart)         -> TeacherCreateResult
//   useUpdateTeacher()        PATCH  /api/teachers/[id]                -> TeacherUpdateResult
//   useSaveTeacherTimetable() PUT    /api/teachers/[id]/timetable      -> TeacherTimetableSaveResult
//   useDeleteTeacher()        DELETE /api/teachers/[id]                -> TeacherDeleteResult
//
// Reads/writes are school-scoped from the session. Mutations invalidate
// qk.teachers.all (list, profile, edit data, timetable, attendance) and
// qk.subjects.all. Errors are HttpError (lib/api/http.ts): `error.message` is safe
// to show, `error.code` / `error.details` carry the machine-readable part.
// =============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, apiSendForm, HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type {
  TeacherAttendanceData,
  TeacherCreateInput,
  TeacherCreateResult,
  TeacherDeleteResult,
  TeacherEditData,
  TeacherFormOptions,
  TeacherListItem,
  TeacherProfileData,
  TeacherTimetableData,
  TeacherTimetableSaveResult,
  TeacherUpdateInput,
  TeacherUpdateResult,
  TimetableSlotInput,
} from "@/lib/dto/teachers";

export type {
  ClassOption,
  SchoolOption,
  SubjectOption,
  TeacherAttendanceData,
  TeacherAttendanceRecord,
  TeacherCreateInput,
  TeacherCreateResult,
  TeacherDeleteResult,
  TeacherEditData,
  TeacherFormOptions,
  TeacherListItem,
  TeacherProfileData,
  TeacherPupil,
  TeacherStatus,
  TeacherTimetableData,
  TeacherTimetableSaveInput,
  TeacherTimetableSaveResult,
  TeacherUpdateInput,
  TeacherUpdateResult,
  TimetableConflict,
  TimetableDay,
  TimetableItemType,
  TimetableSlot,
  TimetableSlotInput,
} from "@/lib/dto/teachers";
export {
  MAX_TIMETABLE_SLOTS,
  TEACHER_PHOTO_MAX_BYTES,
  TEACHER_STATUSES,
  TIMETABLE_DAYS,
  TIMETABLE_ITEM_TYPES,
  TIMETABLE_SLOT_STARTS,
} from "@/lib/dto/teachers";

type Envelope<T> = { ok: true; data: T };

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

// ---- reads -------------------------------------------------------------------

/** Schools (the caller's own), classes (with class_teacher_id) and the subject catalogue for the create form. */
export function useTeacherFormOptions() {
  return useQuery({
    queryKey: qk.teacherAdmin.formOptions(),
    queryFn: ({ signal }) =>
      apiGet<Envelope<TeacherFormOptions>>("/api/teachers/form-options", signal).then((res) => res.data),
    staleTime: 300_000,
  });
}

/** Teacher profile plus the pupils of their classes (each with average grade). Idle while `id` is undefined. */
export function useTeacher(id: string | undefined) {
  return useQuery({
    queryKey: qk.teachers.detail(id ?? ""),
    queryFn: ({ signal }) =>
      apiGet<Envelope<TeacherProfileData>>(`/api/teachers/${id}`, signal).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Everything the edit page loads: teacher, subject catalogue, school classes, assignments and timetable. */
export function useTeacherEditData(id: string | undefined) {
  return useQuery({
    queryKey: qk.teacherAdmin.editData(id ?? ""),
    queryFn: ({ signal }) =>
      apiGet<Envelope<TeacherEditData>>(`/api/teachers/${id}/edit-data`, signal).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** The teacher's weekly timetable with the class and subject lists that label it. */
export function useTeacherTimetable(id: string | undefined) {
  return useQuery({
    queryKey: qk.teacherAdmin.timetable(id ?? ""),
    queryFn: ({ signal }) =>
      apiGet<Envelope<TeacherTimetableData>>(`/api/teachers/${id}/timetable`, signal).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * The teacher's clock-in records (newest 200) and present/late/absent counts.
 * This is what the old `/dashboard/teachers/[id]/students` page actually showed.
 */
export function useTeacherAttendance(id: string | undefined) {
  return useQuery({
    queryKey: qk.teacherAdmin.attendance(id ?? ""),
    queryFn: ({ signal }) =>
      apiGet<Envelope<TeacherAttendanceData>>(`/api/teachers/${id}/attendance`, signal).then((res) => res.data),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

// ---- writes ------------------------------------------------------------------

/** Variables of useUpdateTeacher(). */
export type UpdateTeacherVariables = {
  id: string;
  /** Only the keys you send change (status toggle: `{ status: "suspended" }`). */
  changes: TeacherUpdateInput;
  /** Replacement photo (image, max 5 MB). When set the request is sent as multipart. */
  photo?: File | null;
};

/** Variables of useDeleteTeacher(). */
export type DeleteTeacherVariables = {
  id: string;
  /** Set after the admin confirmed losing the teacher's grading results (see isGradingReportsConflict). */
  force?: boolean;
};

/** Variables of useSaveTeacherTimetable(). */
export type SaveTeacherTimetableVariables = { id: string; slots: TimetableSlotInput[] };

function refreshTeacherData(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.teachers.all }),
    queryClient.invalidateQueries({ queryKey: qk.subjects.all }),
  ]);
}

/**
 * Create a teacher (multipart, photo required). Wraps the existing POST /api/teachers:
 * the school comes from the session, the teacher gets one class and one subject.
 * Resolves to `{ id, teacher }`; 409 when the class already has a class teacher or the teacher ID exists.
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TeacherCreateInput) => {
      const form = new FormData();
      form.set("name", input.name);
      form.set("email", input.email);
      form.set("phone", input.phone);
      form.set("admission_number", input.admission_number);
      form.set("class_id", input.class_id);
      form.set("subject_id", String(input.subject_id));
      form.set("photo", input.photo);
      return apiSendForm<Envelope<TeacherCreateResult>>("POST", "/api/teachers", form).then((res) => res.data);
    },
    onSuccess: () => refreshTeacherData(queryClient),
  });
}

/**
 * Save teacher changes: profile fields, status, class-teacher ownership, subjects,
 * timetable and photo, atomically. Resolves to `{ id, teacher (list row), timetable_conflicts }`.
 * Errors: 400 invalid, 404 not in your school, 409 (`error.code`: TEACHER_EMAIL_TAKEN,
 * TEACHER_ID_TAKEN, CLASS_TEACHER_TAKEN).
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes, photo }: UpdateTeacherVariables) => {
      if (photo) {
        const form = new FormData();
        form.set("payload", JSON.stringify(changes));
        form.set("photo", photo);
        return apiSendForm<Envelope<TeacherUpdateResult>>("PATCH", `/api/teachers/${id}`, form).then((res) => res.data);
      }
      return apiSend<Envelope<TeacherUpdateResult>>("PATCH", `/api/teachers/${id}`, changes).then((res) => res.data);
    },
    onSuccess: () => refreshTeacherData(queryClient),
  });
}

/** Replace a teacher's whole weekly timetable. Resolves to the saved slots and any overlap warnings. */
export function useSaveTeacherTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, slots }: SaveTeacherTimetableVariables) =>
      apiSend<Envelope<TeacherTimetableSaveResult>>("PUT", `/api/teachers/${id}/timetable`, { slots }).then(
        (res) => res.data,
      ),
    onSuccess: () => refreshTeacherData(queryClient),
  });
}

/**
 * Delete a teacher. If the teacher recorded grading results the server answers 409
 * (`code` TEACHER_HAS_GRADING_REPORTS, `details.grading_reports` = how many) because
 * deleting the teacher also deletes those results; ask the admin, then call again with
 * `force: true`. The teacher's cached profile is dropped so an open page does not refetch a 404.
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: DeleteTeacherVariables) =>
      apiSend<Envelope<TeacherDeleteResult>>(
        "DELETE",
        `/api/teachers/${id}${force ? "?force=true" : ""}`,
      ).then((res) => res.data),
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: qk.teachers.detail(result.id) });
      queryClient.removeQueries({ queryKey: qk.teacherAdmin.editData(result.id) });
      queryClient.removeQueries({ queryKey: qk.teacherAdmin.timetable(result.id) });
      queryClient.removeQueries({ queryKey: qk.teacherAdmin.attendance(result.id) });
      return Promise.all([refreshTeacherData(queryClient), queryClient.invalidateQueries({ queryKey: qk.students.all })]);
    },
  });
}

/**
 * When a delete failed because the teacher has grading results, returns how many
 * results would be lost; otherwise null. Use it to show the "delete anyway?" confirm.
 */
export function isGradingReportsConflict(error: unknown): number | null {
  if (!(error instanceof HttpError) || error.status !== 409) return null;
  if (error.code !== "TEACHER_HAS_GRADING_REPORTS") return null;
  const details = error.details as { grading_reports?: unknown } | null | undefined;
  const count = Number(details?.grading_reports);
  return Number.isFinite(count) ? count : 0;
}
