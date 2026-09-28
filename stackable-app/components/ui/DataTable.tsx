"use client";

/**
 * DataTable - the one table for every dashboard list (TanStack Table v8).
 *
 * Generic usage (client mode: sorting, search and paging happen in the browser)
 *
 *   type Student = { id: string; name: string; grade: string; status: "active" | "suspended" };
 *
 *   const columns: ColumnDef<Student, any>[] = [           // eslint-disable-line @typescript-eslint/no-explicit-any
 *     {
 *       accessorKey: "name",
 *       header: "Student",
 *       cell: (c) => <span className="font-semibold text-ink">{c.getValue<string>()}</span>,
 *     },
 *     { accessorKey: "grade", header: "Grade", meta: { className: "tabular-nums" } },
 *     {
 *       accessorKey: "status",
 *       header: "Status",
 *       cell: (c) => <Badge tone={c.getValue<string>() === "active" ? "active" : "suspended"} dot>{c.getValue<string>()}</Badge>,
 *     },
 *   ];
 *
 *   <DataTable<Student>
 *     columns={columns}
 *     data={students ?? []}
 *     loading={isLoading}
 *     getRowId={(s) => s.id}
 *     onRowClick={(s) => router.push(`/dashboard/students/${s.id}`)}
 *     rowActions={(s) => <Button size="sm" variant="ghost" iconOnly leftIcon="solar:menu-dots-bold" aria-label="Actions" />}
 *     filters={<Select size="sm" pill>...</Select>}
 *     toolbar={<Button leftIcon="solar:add-circle-linear">Add student</Button>}
 *   />
 *
 * Column tips
 * - Extra per-column options via `meta`: { className, headerClassName, align: "left" | "center" | "right" }.
 * - Use `enableSorting: false` on display columns. Global search only reads
 *   accessor columns (string / number values).
 *
 * SERVER mode (page through an API; same component, no second table)
 *
 *   <DataTable<Student>
 *     manual
 *     columns={columns}
 *     data={query.data?.rows ?? []}
 *     total={query.data?.total}
 *     loading={query.isLoading}
 *     page={page}                       // 1-based
 *     pageSize={pageSize}
 *     onPageChange={setPage}
 *     onPageSizeChange={setPageSize}    // makes `pageSize` controlled
 *     sorting={sorting}
 *     onSortingChange={setSorting}
 *     onSearchChange={setSearch}        // debounced 300ms; page resets to 1
 *   />
 *
 * In manual mode the table never sorts / filters / slices `data` itself: it
 * renders exactly the rows you pass and reports the user's intent through the
 * callbacks. `page` is 1-based everywhere.
 *
 * Behaviour: click a header to sort (asc, desc, off; aria-sort + icon), search
 * pill (rounded-full field), footer "Showing X-Y of Z" with prev / next and a
 * page-size select, whole-row click + Enter/Space when `onRowClick` is set
 * (clicks on buttons / links / inputs inside a row are ignored; the
 * `rowActions` cell never triggers the row click), skeleton rows while
 * `loading`, EmptyState when there is nothing to show, zebra rows by tone (no
 * divider lines), horizontal scroll on small screens. `stickyHeader` turns the
 * table region into a 70vh scroll area so the header can stick inside it.
 * `searchable` defaults to true.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Select } from "./Select";
import { Skeleton } from "./Skeleton";

declare module "@tanstack/react-table" {
  // Type params must match the library declaration even though unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Extra classes for this column's <td> cells. */
    className?: string;
    /** Extra classes for this column's <th>. */
    headerClassName?: string;
    align?: "left" | "center" | "right";
  }
}

export interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  /** Show the search pill. Default true. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Filter controls rendered beside the search pill. */
  filters?: ReactNode;
  /** Right-aligned toolbar slot (e.g. an "Add" button). */
  toolbar?: ReactNode;
  /** Rows per page (initial value; controlled in manual mode when onPageSizeChange is set). Default 10. */
  pageSize?: number;
  pageSizeOptions?: number[];
  onRowClick?: (row: T) => void;
  /** Right-aligned actions cell; clicks inside never trigger onRowClick. */
  rowActions?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  getRowId?: (row: T) => string;
  className?: string;
  stickyHeader?: boolean;
  /** Screen-reader caption / region label. */
  caption?: string;

  /* ---- server mode ---- */
  /** Sorting, searching and paging are done by the caller (API). */
  manual?: boolean;
  /** Total rows across all pages (manual mode). */
  total?: number;
  /** Current page, 1-based. Controlled when provided. */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Called with the search text (debounced 300ms in manual mode). */
  onSearchChange?: (query: string) => void;
  /** Controlled sorting state. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  onPageSizeChange?: (pageSize: number) => void;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;
const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6"] as const;
const ACTIONS_COLUMN_ID = "__actions";
/** Elements inside a row whose clicks must not trigger the row click. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [data-no-row-click]';

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  const icon =
    state === "asc"
      ? "solar:alt-arrow-up-bold"
      : state === "desc"
        ? "solar:alt-arrow-down-bold"
        : "solar:sort-vertical-linear";
  return (
    <Icon
      icon={icon}
      width={14}
      className={cn(
        "shrink-0 transition-opacity duration-300 ease-standard",
        state ? "text-primary-ink opacity-100" : "opacity-40 group-hover/sort:opacity-100",
      )}
    />
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function DataTable<T>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search",
  filters,
  toolbar,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50],
  onRowClick,
  rowActions,
  emptyState,
  getRowId,
  className,
  stickyHeader = false,
  caption,
  manual = false,
  total,
  page,
  onPageChange,
  onSearchChange,
  sorting,
  onSortingChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  // TanStack Table returns instance objects the React Compiler cannot track;
  // opt this component out so the table always re-renders with its state.
  "use no memo";

  const [innerSorting, setInnerSorting] = useState<SortingState>([]);
  const [innerPage, setInnerPage] = useState(1);
  const [innerPageSize, setInnerPageSize] = useState(pageSize);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  const sortingState = sorting ?? innerSorting;
  const effectivePageSize = manual && onPageSizeChange ? pageSize : innerPageSize;
  const currentPage = Math.max(1, page ?? innerPage);

  const resetPage = () => {
    if (page === undefined) setInnerPage(1);
    onPageChange?.(1);
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sortingState) : updater;
    if (sorting === undefined) setInnerSorting(next);
    onSortingChange?.(next);
    if (currentPage !== 1) resetPage();
  };

  const allColumns = useMemo<ColumnDef<T, any>[]>(() => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!rowActions) return columns;
    const actions: ColumnDef<T, unknown> = {
      id: ACTIONS_COLUMN_ID,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => rowActions(row.original),
      enableSorting: false,
      enableGlobalFilter: false,
      meta: { className: "w-px whitespace-nowrap", headerClassName: "w-px", align: "right" },
    };
    return [...columns, actions];
  }, [columns, rowActions]);

  // eslint-disable-next-line react-hooks/incompatible-library -- expected: this component opts out via "use no memo"
  const table = useReactTable<T>({
    data,
    columns: allColumns,
    state: {
      sorting: sortingState,
      globalFilter: manual ? undefined : query,
      pagination: { pageIndex: currentPage - 1, pageSize: effectivePageSize },
    },
    onSortingChange: handleSortingChange,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
    getFilteredRowModel: manual ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manual ? undefined : getPaginationRowModel(),
    manualSorting: manual,
    manualFiltering: manual,
    manualPagination: manual,
    rowCount: manual ? (total ?? data.length) : undefined,
    autoResetPageIndex: false,
    defaultColumn: { sortDescFirst: false },
  });

  const totalRows = manual ? (total ?? data.length) : table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / effectivePageSize));

  // Data shrank (or the filter narrowed) below the current page: step back.
  // Render-phase state adjustment on our own state; re-renders before paint.
  if (!manual && page === undefined && currentPage > pageCount) {
    setInnerPage(pageCount);
  }

  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (page === undefined) setInnerPage(clamped);
    onPageChange?.(clamped);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    window.clearTimeout(debounceRef.current);
    if (manual) {
      debounceRef.current = window.setTimeout(() => {
        onSearchChange?.(value);
        resetPage();
      }, 300);
    } else {
      onSearchChange?.(value);
      resetPage();
    }
  };

  const handlePageSize = (next: number) => {
    setInnerPageSize(next);
    onPageSizeChange?.(next);
    resetPage();
  };

  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;
  const skeletonRows = Math.min(effectivePageSize, 8);
  const isClickable = Boolean(onRowClick);

  const startIdx = totalRows === 0 ? 0 : (Math.min(currentPage, pageCount) - 1) * effectivePageSize + 1;
  const endIdx = totalRows === 0 ? 0 : startIdx + rows.length - 1;
  const summary = totalRows === 0 ? "No entries" : `Showing ${fmt(startIdx)}-${fmt(endIdx)} of ${fmt(totalRows)}`;

  const sizeOptions = Array.from(new Set([...pageSizeOptions, effectivePageSize])).sort((a, b) => a - b);

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    const hit = (event.target as HTMLElement).closest(INTERACTIVE);
    if (hit && hit !== event.currentTarget && event.currentTarget.contains(hit)) return;
    onRowClick?.(row);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  const hasToolbar = searchable || Boolean(filters) || Boolean(toolbar);

  return (
    <section className={cn("overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-ghost", className)}>
      {hasToolbar ? (
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          {searchable ? (
            <Input
              pill
              type="search"
              autoComplete="off"
              leftIcon="solar:magnifer-linear"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(event) => handleSearch(event.target.value)}
              className="sm:max-w-xs"
              inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
              rightAdornment={
                query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => handleSearch("")}
                    className="grid size-5 place-items-center rounded-full text-muted transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    <Icon icon="solar:close-circle-bold" width={16} />
                  </button>
                ) : null
              }
            />
          ) : null}
          {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
          {toolbar ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div> : null}
        </div>
      ) : null}

      <div
        role="region"
        aria-label={caption ?? "Data table"}
        tabIndex={0}
        className={cn(
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
          stickyHeader ? "max-h-[70vh] overflow-auto" : "overflow-x-auto",
        )}
      >
        <table className="w-full min-w-[640px] text-sm" aria-busy={loading || undefined}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = header.column;
                  const canSort = column.getCanSort();
                  const sorted = column.getIsSorted();
                  const meta = column.columnDef.meta;
                  const content = header.isPlaceholder ? null : flexRender(column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
                      className={cn(
                        "bg-recessed px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted uppercase",
                        ALIGN[meta?.align ?? "left"],
                        stickyHeader && "sticky top-0 z-10",
                        meta?.headerClassName,
                      )}
                    >
                      {canSort && !header.isPlaceholder ? (
                        <button
                          type="button"
                          onClick={column.getToggleSortingHandler()}
                          className={cn(
                            "group/sort -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 tracking-wider uppercase",
                            "transition-colors duration-300 ease-standard hover:text-ink focus-visible:outline-2 focus-visible:outline-focus",
                            sorted && "text-ink",
                          )}
                        >
                          {content}
                          <SortIcon state={sorted} />
                        </button>
                      ) : (
                        content
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={`skeleton-${r}`} className="odd:bg-surface even:bg-recessed/50">
                  {Array.from({ length: columnCount }).map((__, c) => (
                    <td key={c} className="px-4 py-3.5">
                      <Skeleton className={cn("h-4", SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length])} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columnCount)} className="p-0">
                  {emptyState ?? (
                    <EmptyState
                      icon={query ? "solar:magnifer-linear" : "solar:inbox-linear"}
                      title={query ? "No results found" : "Nothing here yet"}
                      description={query ? `Nothing matches "${query}". Try a different search.` : undefined}
                    />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? (event) => handleRowClick(event, row.original) : undefined}
                  onKeyDown={isClickable ? (event) => handleRowKeyDown(event, row.original) : undefined}
                  className={cn(
                    "odd:bg-surface even:bg-recessed/50",
                    "transition-colors duration-300 ease-standard",
                    isClickable &&
                      "cursor-pointer hover:bg-primary-tint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta;
                    const isActions = cell.column.id === ACTIONS_COLUMN_ID;
                    return (
                      <td
                        key={cell.id}
                        onClick={isActions ? (event) => event.stopPropagation() : undefined}
                        data-no-row-click={isActions ? "" : undefined}
                        className={cn("px-4 py-3 align-middle text-ink-soft", ALIGN[meta?.align ?? "left"], meta?.className)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-ink-soft tabular-nums" aria-live="polite">
          {loading ? <Skeleton className="h-3.5 w-36" /> : summary}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="hidden sm:inline">Rows per page</span>
            <Select
              size="sm"
              aria-label="Rows per page"
              value={effectivePageSize}
              onChange={(event) => handlePageSize(Number(event.target.value))}
              className="w-[4.75rem]"
            >
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon="solar:alt-arrow-left-linear"
              aria-label="Previous page"
              disabled={loading || currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            />
            <span className="min-w-[5.5rem] text-center text-xs text-ink-soft tabular-nums">
              Page {fmt(Math.min(currentPage, pageCount))} of {fmt(pageCount)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              leftIcon="solar:alt-arrow-right-linear"
              aria-label="Next page"
              disabled={loading || currentPage >= pageCount}
              onClick={() => goToPage(currentPage + 1)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default DataTable;
