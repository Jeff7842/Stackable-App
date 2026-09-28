// =============================================================================
// useTeacherPortal - the teacher home data (GET /api/teach/portal-data).
// -----------------------------------------------------------------------------
// The response shape is the TeacherPortalData contract in
// lib/repositories/portal-types.ts. Until the backend ships every new field the
// route may still return the OLD subset (teacher, classes, subjects,
// studentCount), so `normalize` fills the new fields with safe defaults. The
// pages can then read `data.today.lessons` etc. without any optional chaining.
//
// Feels live: refetches quietly every 60 s (only while the tab is visible) and
// whenever the window regains focus.
// =============================================================================

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type { TeacherClassCard, TeacherPortalData } from "@/lib/repositories/portal-types";

export type { TeacherPortalData } from "@/lib/repositories/portal-types";

// Names kept from before the contract existed, now aliases of the contract types.
export type TeacherInfo = TeacherPortalData["teacher"];
export type TeacherClass = TeacherClassCard;
export type TeacherSubject = TeacherPortalData["subjects"][number];

type PortalResponse = {
  ok: true;
  data: Partial<TeacherPortalData>;
};

const REFRESH_MS = 60_000;

/** Fill any field an older backend does not send yet. */
function normalize(raw: Partial<TeacherPortalData>): TeacherPortalData {
  return {
    teacher: raw.teacher ?? { id: "", name: "Teacher", email: null, status: "active" },
    schoolName: raw.schoolName ?? null,
    classes: (raw.classes ?? []).map((c) => ({
      ...c,
      stream: c.stream ?? null,
      totalStudents: c.totalStudents ?? null,
      studentCount: c.studentCount ?? c.totalStudents ?? 0,
      presentToday: c.presentToday ?? null,
    })),
    subjects: raw.subjects ?? [],
    studentCount: raw.studentCount ?? 0,
    today: {
      date: raw.today?.date ?? "",
      weekday: raw.today?.weekday ?? "",
      lessons: raw.today?.lessons ?? [],
    },
    recentGrading: raw.recentGrading ?? [],
    attention: raw.attention ?? [],
  };
}

export function useTeacherPortal() {
  return useQuery({
    queryKey: qk.teachers.detail("portal"),
    queryFn: ({ signal }) =>
      apiGet<PortalResponse>("/api/teach/portal-data", signal).then((r) => normalize(r.data ?? {})),
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
