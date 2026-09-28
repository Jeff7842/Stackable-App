// Column definitions for the teacher's students table. Kept at MODULE level so the
// array identity is stable between renders (DataTable memoises on it).
// Search (the DataTable pill) reads accessor columns whose value is a string or a
// number; the numeric columns opt out so typing "72" does not match averages.

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, Badge } from "@/components/ui";
import type { TeacherStudent } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { attendanceDot, capitalize, formatPct, fullName, scoreBar, statusTone } from "./helpers";

export const studentColumns: ColumnDef<TeacherStudent, any>[] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
  {
    id: "name",
    accessorFn: (s) => fullName(s.firstName, s.lastName),
    header: "Student",
    cell: ({ row }) => {
      const s = row.original;
      const name = fullName(s.firstName, s.lastName);
      return (
        <div className="flex min-w-[11rem] items-center gap-3">
          <Avatar name={name} src={s.profilePicture} size="sm" />
          <span className="font-semibold text-ink">{name}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "admissionNo",
    header: "Admission no",
    meta: { className: "whitespace-nowrap tabular-nums" },
  },
  {
    id: "className",
    accessorFn: (s) => s.className ?? "",
    header: "Class",
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.className ?? "-"}</span>,
  },
  {
    id: "average",
    // -1 sorts "no grades" below every real score.
    accessorFn: (s) => s.averagePct ?? -1,
    header: "Average",
    enableGlobalFilter: false,
    cell: ({ row }) => {
      const { averagePct, averageGrade } = row.original;
      if (averagePct == null) return <span className="text-muted">No grades</span>;
      const width = Math.max(0, Math.min(100, averagePct));
      return (
        <div className="flex min-w-[9.5rem] items-center gap-3">
          <span className="w-16 whitespace-nowrap font-semibold tabular-nums text-ink">
            {averageGrade ? `${averageGrade} ` : ""}
            <span className={cn(averageGrade ? "font-medium text-ink-soft" : "")}>{formatPct(averagePct)}</span>
          </span>
          <div aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-field">
            <div className={cn("h-full rounded-full", scoreBar(averagePct))} style={{ width: `${width}%` }} />
          </div>
        </div>
      );
    },
  },
  {
    id: "attendance",
    accessorFn: (s) => s.attendanceRate ?? -1,
    header: "Attendance",
    enableGlobalFilter: false,
    cell: ({ row }) => {
      const rate = row.original.attendanceRate;
      if (rate == null) return <span className="text-muted">No records</span>;
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
          <span aria-hidden="true" className={cn("size-2 rounded-full", attendanceDot(rate))} />
          {formatPct(rate)}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge tone={statusTone(row.original.status)} dot>
        {capitalize(row.original.status)}
      </Badge>
    ),
  },
];
