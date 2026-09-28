"use client";

// The students list: the shared DataTable with student columns and row
// actions (suspend / activate, edit, delete). Filtering happens upstream
// (StudentFilters) so the grid shows the same rows; DataTable's own search
// is disabled here and only sorts + pages the already-filtered array.

import type { ReactNode } from "react";
import { createColumnHelper, type OnChangeFn, type SortingState } from "@tanstack/react-table";
import { Avatar, Button, DataTable, Icon } from "@/components/ui";
import type { StudentClassOption, StudentListItem } from "@/hooks/useStudents";
import { StudentStatusBadge } from "./StatusBadge";
import { classLabel, formatDate } from "./utils";

const col = createColumnHelper<StudentListItem>();
const dash = <span className="text-muted">—</span>;

function columnsFor(classes: StudentClassOption[]) {
  return [
    col.accessor((s) => s.full_name, {
      id: "student",
      header: "Student",
      cell: ({ row }) => {
        const student = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar name={student.full_name} src={student.profile_picture} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{student.full_name}</p>
              <p className="text-xs text-muted tabular-nums">{student.admission_no}</p>
            </div>
          </div>
        );
      },
    }),
    col.accessor((s) => classLabel(s.class_id, classes), {
      id: "class",
      header: "Class",
      cell: (c) => c.getValue() || dash,
    }),
    col.accessor((s) => [s.phone, s.phone2].filter(Boolean).join(" "), {
      id: "contact",
      header: "Parent contact",
      meta: { className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const { phone, phone2 } = row.original;
        if (!phone && !phone2) return dash;
        return (
          <div>
            <div>{phone ?? phone2}</div>
            {phone && phone2 ? <div className="text-xs text-muted">{phone2}</div> : null}
          </div>
        );
      },
    }),
    col.accessor((s) => s.status, {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
    }),
    col.accessor((s) => s.average_grade ?? "", {
      id: "average",
      header: "Average grade",
      cell: (c) => c.getValue() || dash,
    }),
    col.accessor((s) => s.date_of_birth ?? "", {
      id: "dob",
      header: "Date of birth",
      meta: { className: "whitespace-nowrap" },
      cell: (c) => formatDate(c.getValue() || null),
    }),
    col.accessor((s) => s.created_at, {
      id: "joined",
      header: "Joined",
      meta: { className: "tabular-nums whitespace-nowrap" },
      cell: (c) => formatDate(c.getValue()),
    }),
  ];
}

export interface StudentsTableProps {
  students: StudentListItem[];
  classes: StudentClassOption[];
  loading: boolean;
  emptyState: ReactNode;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  busyId: string | null;
  onView: (student: StudentListItem) => void;
  onEdit: (student: StudentListItem) => void;
  onToggleStatus: (student: StudentListItem) => void;
  onDelete: (student: StudentListItem) => void;
}

export function StudentsTable({
  students,
  classes,
  loading,
  emptyState,
  sorting,
  onSortingChange,
  pageSize,
  onPageSizeChange,
  busyId,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}: StudentsTableProps) {
  "use no memo"; // TanStack Table + React Compiler (see DataTable)

  return (
    <DataTable<StudentListItem>
      columns={columnsFor(classes)}
      data={students}
      loading={loading}
      caption="Students"
      getRowId={(s) => s.id}
      searchable={false}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      pageSizeOptions={[10, 20, 50]}
      emptyState={emptyState}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onRowClick={onView}
      rowActions={(student) => {
        const suspended = student.status === "suspended";
        const busy = busyId === student.id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={suspended ? `Activate ${student.full_name}` : `Suspend ${student.full_name}`}
              title={suspended ? "Activate" : "Suspend"}
              disabled={busy}
              onClick={() => onToggleStatus(student)}
            >
              <Icon
                icon={suspended ? "solar:lock-keyhole-minimalistic-unlocked-linear" : "solar:lock-keyhole-minimalistic-linear"}
                width={16}
                className={suspended ? "text-success" : "text-warning"}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon="solar:pen-2-linear"
              aria-label={`Edit ${student.full_name}`}
              title="Edit"
              onClick={() => onEdit(student)}
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Delete ${student.full_name}`}
              title="Delete"
              disabled={busy}
              onClick={() => onDelete(student)}
            >
              <Icon icon="solar:trash-bin-trash-linear" width={16} className="text-danger" />
            </Button>
          </div>
        );
      }}
    />
  );
}

export default StudentsTable;
