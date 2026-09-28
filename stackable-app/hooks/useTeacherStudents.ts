// =============================================================================
// Teacher student hooks.
//   useTeacherStudents()            GET /api/teach/students        -> { students, total }
//   useTeacherStudentProfile(id)    GET /api/teach/students/[id]   -> TeacherStudentProfile
//
// Types come from the contract in lib/repositories/portal-types.ts. The list and
// profile are normalised so a backend that has not shipped the newer fields yet
// (averagePct, attendanceRate, grades, attendance ...) never crashes the pages.
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { TeacherStudent, TeacherStudentProfile } from "@/lib/repositories/portal-types";

export type { TeacherStudent, TeacherStudentProfile } from "@/lib/repositories/portal-types";

type StudentsResponse = {
  ok: true;
  data: {
    students: Partial<TeacherStudent>[];
    total?: number;
  };
};

type ProfileResponse = {
  ok: true;
  data: Partial<TeacherStudentProfile> & { student: Partial<TeacherStudentProfile["student"]> };
};

export type TeacherStudentList = { students: TeacherStudent[]; total: number };

function normalizeStudent(s: Partial<TeacherStudent>): TeacherStudent {
  return {
    id: s.id ?? "",
    firstName: s.firstName ?? "",
    lastName: s.lastName ?? "",
    admissionNo: s.admissionNo ?? "",
    status: s.status ?? "active",
    classId: s.classId ?? null,
    className: s.className ?? null,
    profilePicture: s.profilePicture ?? null,
    averageGrade: s.averageGrade ?? null,
    averagePct: s.averagePct ?? null,
    attendanceRate: s.attendanceRate ?? null,
  };
}

export function useTeacherStudents() {
  return useQuery({
    queryKey: qk.teachers.detail("portal-students"),
    queryFn: ({ signal }): Promise<TeacherStudentList> =>
      apiGet<StudentsResponse>("/api/teach/students", signal).then((r) => {
        const students = (r.data?.students ?? []).map(normalizeStudent);
        return { students, total: r.data?.total ?? students.length };
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * One assigned student's profile. Pass `null` (or `enabled = false`) while the
 * drawer is closed: nothing is fetched until a student is actually opened, and
 * the cache keeps the last profile so reopening is instant.
 */
export function useTeacherStudentProfile(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.teacher.studentProfile(id ?? ""),
    enabled: Boolean(id) && enabled,
    queryFn: ({ signal }): Promise<TeacherStudentProfile> =>
      apiGet<ProfileResponse>(`/api/teach/students/${encodeURIComponent(id ?? "")}`, signal).then((r) => {
        const data = r.data;
        const base = normalizeStudent(data.student);
        return {
          student: {
            ...base,
            dateOfBirth: data.student.dateOfBirth ?? null,
            email: data.student.email ?? null,
          },
          grades: data.grades ?? [],
          attendance: data.attendance ?? { present: 0, late: 0, absent: 0, total: 0, rate: 0 },
        };
      }),
    staleTime: 30_000,
    // A 404 ("not assigned to you") will not fix itself: fail fast instead of retrying.
    retry: false,
  });
}
