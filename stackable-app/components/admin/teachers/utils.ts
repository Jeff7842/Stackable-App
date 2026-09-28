/**
 * Teachers admin - formatting helpers, filter state and the pure filter /
 * sort functions shared by the table and grid so both views show the same
 * rows. Free-text search runs here too (both views share one filter bar).
 */
import type { SortingState } from "@tanstack/react-table";
import type { BadgeTone } from "@/components/ui";
import type { ClassOption, TeacherListItem, TeacherStatus } from "@/hooks/useTeachers";

export type TeacherFilterState = {
  search: string;
  subjectId: string;
  status: TeacherStatus | "all";
  classTeacher: "all" | "yes" | "no";
};

export const EMPTY_FILTERS: TeacherFilterState = { search: "", subjectId: "all", status: "all", classTeacher: "all" };

export const hasActiveFilters = (f: TeacherFilterState) =>
  f.search.trim() !== "" || f.subjectId !== "all" || f.status !== "all" || f.classTeacher !== "all";

export function filterTeachers(teachers: TeacherListItem[], filters: TeacherFilterState) {
  const q = filters.search.trim().toLowerCase();
  return teachers.filter((teacher) => {
    const matchesSearch =
      !q ||
      teacher.name.toLowerCase().includes(q) ||
      (teacher.email ?? "").toLowerCase().includes(q) ||
      teacher.admission_number.toLowerCase().includes(q) ||
      (teacher.phone ?? "").toLowerCase().includes(q) ||
      (teacher.school_name ?? "").toLowerCase().includes(q) ||
      (teacher.subject_name ?? "").toLowerCase().includes(q);

    const matchesSubject = filters.subjectId === "all" || String(teacher.subject_id ?? "") === filters.subjectId;
    const matchesStatus = filters.status === "all" || teacher.status === filters.status;
    const matchesClassTeacher =
      filters.classTeacher === "all" ||
      (filters.classTeacher === "yes" && teacher.class_teacher) ||
      (filters.classTeacher === "no" && !teacher.class_teacher);

    return matchesSearch && matchesSubject && matchesStatus && matchesClassTeacher;
  });
}

/** Sorts by the same column ids TeachersTable uses, for the grid view's own pager. */
export function sortTeachers(teachers: TeacherListItem[], sorting: SortingState) {
  const [rule] = sorting;
  if (!rule) return teachers;
  const dir = rule.desc ? -1 : 1;
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  return [...teachers].sort((a, b) => {
    switch (rule.id) {
      case "attendance":
        return (num(a.attendance_percentage) - num(b.attendance_percentage)) * dir;
      case "joined":
        return (a.created_at ?? "").localeCompare(b.created_at ?? "") * dir;
      case "admission":
        return a.admission_number.localeCompare(b.admission_number) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "teacher":
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
}

export const STATUS_LABEL: Record<TeacherStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  on_leave: "On leave",
  retired: "Retired",
  terminated: "Terminated",
};

export const STATUS_TONE: Record<TeacherStatus, BadgeTone> = {
  active: "active",
  suspended: "suspended",
  on_leave: "warning",
  retired: "info",
  terminated: "neutral",
};

export function classLabel(classItem: Pick<ClassOption, "class_name" | "stream"> | null | undefined) {
  if (!classItem) return "—";
  return classItem.stream ? `${classItem.class_name} ${classItem.stream}` : classItem.class_name;
}

export function percentage(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    date,
  );
}

export function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
