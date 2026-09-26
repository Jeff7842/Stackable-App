"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";

export type TeacherStudent = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo: string;
  status: string;
  classId: string | null;
  className: string | null;
};

type StudentsResponse = {
  ok: true;
  data: {
    students: TeacherStudent[];
    total: number;
  };
};

export function useTeacherStudents() {
  return useQuery({
    queryKey: qk.teachers.detail("portal-students"),
    queryFn: () =>
      apiGet<StudentsResponse>("/api/teach/students").then((r) => r.data),
  });
}
