/**
 * Students admin - formatting helpers, filter state and the pure filter
 * function shared by the table and grid so both views show the same rows.
 * Free-text search is handled by DataTable itself (accessor columns); this
 * file only covers the class / status selects.
 */
import type { SortingState } from "@tanstack/react-table";
import type { BadgeTone } from "@/components/ui";
import type { StudentClassOption, StudentListItem, StudentStatus } from "@/hooks/useStudents";

export type StudentFilterState = { search: string; classId: string; status: StudentStatus | "all" };

export const EMPTY_FILTERS: StudentFilterState = { search: "", classId: "all", status: "all" };

export const hasActiveFilters = (f: StudentFilterState) =>
  f.search.trim() !== "" || f.classId !== "all" || f.status !== "all";

/** Same fields the old page searched: name, admission, school, both parent contacts and the class label. */
export function filterStudents(students: StudentListItem[], filters: StudentFilterState, classes: StudentClassOption[]) {
  const q = filters.search.trim().toLowerCase();
  return students.filter((student) => {
    const matchesSearch =
      !q ||
      student.full_name.toLowerCase().includes(q) ||
      student.admission_no.toLowerCase().includes(q) ||
      student.school_name.toLowerCase().includes(q) ||
      (student.phone ?? "").toLowerCase().includes(q) ||
      (student.phone2 ?? "").toLowerCase().includes(q) ||
      classLabel(student.class_id, classes).toLowerCase().includes(q);

    const matchesClass = filters.classId === "all" || student.class_id === filters.classId;
    const matchesStatus = filters.status === "all" || student.status === filters.status;
    return matchesSearch && matchesClass && matchesStatus;
  });
}

export const STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  pending: "Pending",
  removed: "Removed",
  graduated: "Graduated",
};

export const STATUS_TONE: Record<StudentStatus, BadgeTone> = {
  active: "active",
  suspended: "suspended",
  pending: "pending",
  removed: "neutral",
  graduated: "info",
};

export function classLabel(classId: string | null, classes: StudentClassOption[]) {
  if (!classId) return "Unassigned";
  return classes.find((item) => item.id === classId)?.label ?? "Unassigned";
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Sorts by the same column ids StudentsTable uses, for the grid view's own pager. */
export function sortStudents(students: StudentListItem[], sorting: SortingState, classes: StudentClassOption[]) {
  const [rule] = sorting;
  if (!rule) return students;
  const dir = rule.desc ? -1 : 1;
  const value = (s: StudentListItem): string => {
    switch (rule.id) {
      case "class":
        return classLabel(s.class_id, classes);
      case "status":
        return s.status;
      case "average":
        return s.average_grade ?? "";
      case "dob":
        return s.date_of_birth ?? "";
      case "joined":
        return s.created_at;
      case "student":
      default:
        return s.full_name;
    }
  };
  return [...students].sort((a, b) => value(a).localeCompare(value(b)) * dir);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
