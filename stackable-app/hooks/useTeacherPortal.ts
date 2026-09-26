"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";

export type TeacherInfo = {
  id: string;
  name: string;
  email: string | null;
  status: string;
};

export type TeacherClass = {
  id: string;
  name: string;
  stream: string | null;
  totalStudents: number | null;
};

export type TeacherSubject = {
  id: string;
  subjectName: string;
};

export type TeacherPortalData = {
  teacher: TeacherInfo;
  classes: TeacherClass[];
  subjects: TeacherSubject[];
  studentCount: number;
};

type PortalResponse = {
  ok: true;
  data: TeacherPortalData;
};

export function useTeacherPortal() {
  return useQuery({
    queryKey: qk.teachers.detail("portal"),
    queryFn: () =>
      apiGet<PortalResponse>("/api/teach/portal-data").then((r) => r.data),
  });
}
