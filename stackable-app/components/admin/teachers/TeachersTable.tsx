"use client";

// The teachers list: the shared DataTable with teacher columns and a row
// actions menu. Filtering happens upstream (TeacherFilters) so the grid shows
// the same rows; DataTable's own search is disabled here.

import type { ReactNode } from "react";
import { createColumnHelper, type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { Avatar, Badge, DataTable } from "@/components/ui";
import type { TeacherListItem } from "@/hooks/useTeachers";
import { TeacherActionsMenu } from "./TeacherActionsMenu";
import { TeacherStatusBadge } from "./StatusBadge";
import type { TeacherActions } from "./useTeacherActions";
import { percentage } from "./utils";

const col = createColumnHelper<TeacherListItem>();
const dash = <span className="text-muted">—</span>;

const columns = [
  col.accessor((t) => t.name, {
    id: "teacher",
    header: "Teacher",
    cell: ({ row }) => {
      const teacher = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar name={teacher.name} src={teacher.profile_photo} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{teacher.name}</p>
            <p className="truncate text-xs text-muted">{teacher.email || teacher.admission_number}</p>
          </div>
          {teacher.class_teacher ? (
            <Badge tone="info" size="sm">
              Class teacher
            </Badge>
          ) : null}
        </div>
      );
    },
  }),
  col.accessor((t) => t.admission_number, {
    id: "admission",
    header: "Admission",
    meta: { className: "whitespace-nowrap" },
  }),
  col.accessor((t) => t.school_name ?? "", {
    id: "school",
    header: "School",
    cell: (c) => c.getValue() || dash,
  }),
  col.accessor((t) => t.subject_name ?? "", {
    id: "subject",
    header: "Subject",
    cell: (c) => c.getValue() || dash,
  }),
  col.accessor((t) => t.phone ?? "", {
    id: "contact",
    header: "Contact",
    cell: (c) => c.getValue() || dash,
  }),
  col.accessor((t) => percentage(t.attendance_percentage), {
    id: "attendance",
    header: "Attendance",
    meta: { className: "tabular-nums" },
    cell: (c) => `${c.getValue()}%`,
  }),
  col.accessor((t) => t.status, {
    id: "status",
    header: "Status",
    cell: ({ row }) => <TeacherStatusBadge status={row.original.status} />,
  }),
  col.accessor((t) => t.created_at ?? "", {
    id: "joined",
    header: "Joined",
    meta: { className: "tabular-nums whitespace-nowrap" },
  }),
];

export interface TeachersTableProps {
  teachers: TeacherListItem[];
  loading: boolean;
  emptyState: ReactNode;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onView: (teacher: TeacherListItem) => void;
  actions: TeacherActions;
}

export function TeachersTable({
  teachers,
  loading,
  emptyState,
  sorting,
  onSortingChange,
  pageSize,
  onPageSizeChange,
  onView,
  actions,
}: TeachersTableProps) {
  "use no memo"; // TanStack Table + React Compiler (see DataTable)

  return (
    <DataTable<TeacherListItem>
      columns={columns}
      data={teachers}
      loading={loading}
      caption="Teachers"
      getRowId={(t) => t.id}
      searchable={false}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      pageSizeOptions={[10, 20, 50]}
      emptyState={emptyState}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onView}
      rowActions={(teacher) => <TeacherActionsMenu teacher={teacher} actions={actions} />}
    />
  );
}

export default TeachersTable;
