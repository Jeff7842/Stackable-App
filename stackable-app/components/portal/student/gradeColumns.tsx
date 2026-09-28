// Column definitions for the grades tables (student grades page + the parent's child
// profile). Kept at MODULE level so the array identity is stable between renders
// (DataTable memoises on it).
//
// Letters-only data: the Score column is a separate array that callers use ONLY when
// at least one row carries a real score, so a table is never a column of dashes.
// "Performance" is worded from the letter (the API has no teacher remarks yet), which
// is why it is not called "Remark".

import type { ColumnDef } from "@tanstack/react-table";
import type { GradeRow } from "@/lib/repositories/portal-types";
import { formatPct, formatShortDate, gradeRank, performanceLabel } from "./helpers";
import { GradeBadge } from "./parts";

/* eslint-disable @typescript-eslint/no-explicit-any -- TanStack column defs are heterogeneous by design */
const subject: ColumnDef<GradeRow, any> = {
  accessorKey: "subject",
  header: "Subject",
  cell: ({ row }) => <span className="font-semibold text-ink">{row.original.subject}</span>,
};

const term: ColumnDef<GradeRow, any> = {
  accessorKey: "term",
  header: "Term",
  meta: { className: "whitespace-nowrap" },
};

const grade: ColumnDef<GradeRow, any> = {
  id: "grade",
  accessorFn: (r) => r.grade,
  header: "Grade",
  // Sort by how good the letter is, not alphabetically ("B" would sort above "A-").
  sortingFn: (a, b) => (gradeRank(a.original.grade) ?? -1) - (gradeRank(b.original.grade) ?? -1),
  cell: ({ row }) => <GradeBadge grade={row.original.grade} />,
};

const score: ColumnDef<GradeRow, any> = {
  id: "score",
  accessorFn: (r) => r.normalizedPct ?? r.rawScore ?? -1,
  header: "Score",
  enableGlobalFilter: false,
  meta: { className: "whitespace-nowrap tabular-nums" },
  cell: ({ row }) => {
    const { normalizedPct, rawScore } = row.original;
    if (normalizedPct != null) {
      return (
        <span className="font-medium text-ink">
          {formatPct(normalizedPct)}
          {rawScore != null ? <span className="ml-1.5 text-xs text-muted">({rawScore})</span> : null}
        </span>
      );
    }
    if (rawScore != null) return <span className="font-medium text-ink">{rawScore}</span>;
    return <span className="text-muted">-</span>;
  },
};

const performance: ColumnDef<GradeRow, any> = {
  id: "performance",
  accessorFn: (r) => performanceLabel(r.grade),
  header: "Performance",
  meta: { className: "whitespace-nowrap text-ink-soft" },
  cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : <span className="text-muted">-</span>),
};

const recorded: ColumnDef<GradeRow, any> = {
  id: "recorded",
  accessorFn: (r) => {
    const ms = Date.parse(r.createdAt ?? "");
    return Number.isNaN(ms) ? 0 : ms;
  },
  header: "Recorded",
  enableGlobalFilter: false,
  meta: { className: "hidden whitespace-nowrap text-ink-soft md:table-cell", headerClassName: "hidden md:table-cell" },
  cell: ({ row }) => formatShortDate(row.original.createdAt) || <span className="text-muted">-</span>,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Table without a score column (letters-only data). */
export const gradeColumns: ColumnDef<GradeRow, any>[] = [subject, term, grade, performance, recorded]; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Table with a score column (used only when at least one row has a real score). */
export const gradeColumnsWithScore: ColumnDef<GradeRow, any>[] = [subject, term, grade, score, performance, recorded]; // eslint-disable-line @typescript-eslint/no-explicit-any
