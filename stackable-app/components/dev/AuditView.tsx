"use client";

// =============================================================================
// AuditView - /dev/audit. Every impersonation event, server-side paged and
// filterable; a row opens the full record in a drawer.
//
// URL contract (all optional, defaults are omitted from the URL):
//   /dev/audit?action=<prefix>&from=YYYY-MM-DD&to=YYYY-MM-DD&actor=<user id>&target=<user id>&page=<n>&pageSize=<10|25|50>
// `action` is a PREFIX ("impersonation." matches every impersonation event).
// actor / target have no input of their own; they arrive in the URL (for example
// from a link on another page) and show as removable chips.
//
// Needs a <Suspense> boundary above it (useSearchParams); see the page file.
// =============================================================================

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, Button, DataTable, EmptyState, Icon, Input, Select } from "@/components/ui";
import { useDevAudit } from "@/hooks/useDevAudit";
import type { DevAuditRow } from "@/lib/dev-types";
import { AuditDrawer } from "./AuditDrawer";
import { ErrorPanel } from "./ErrorPanel";
import { actionLabel, actionTone, formatDateTime, roleLabel } from "./format";
import { RelativeTime } from "./RelativeTime";
import { useUrlFilters } from "./useUrlFilters";

type AuditFilters = {
  action: string;
  from: string;
  to: string;
  actor: string;
  target: string;
  page: number;
  pageSize: number;
};

const DEFAULTS: AuditFilters = { action: "", from: "", to: "", actor: "", target: "", page: 1, pageSize: 10 };
const PAGE_SIZES = [10, 25, 50];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTION_PATTERN = /^[a-z0-9._:-]{1,64}$/i; // same character set the API accepts

const ACTION_OPTIONS = [
  { value: "", label: "All events" },
  { value: "impersonation.", label: "Impersonation" },
  { value: "impersonation.request", label: "Requests" },
  { value: "impersonation.start", label: "Start" },
  { value: "impersonation.stop", label: "Stop" },
];

function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const action = params.get("action") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Number.parseInt(params.get("page") ?? "", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "", 10);
  return {
    action: ACTION_PATTERN.test(action) ? action : "",
    from: DATE_PATTERN.test(from) ? from : "",
    to: DATE_PATTERN.test(to) ? to : "",
    actor: (params.get("actor") ?? "").trim().slice(0, 64),
    target: (params.get("target") ?? "").trim().slice(0, 64),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULTS.pageSize,
  };
}

// The API does not sort (newest first), so no column is sortable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<DevAuditRow, any>[] = [
  {
    id: "time",
    header: "Time",
    accessorFn: (event) => event.createdAt,
    enableSorting: false,
    meta: { className: "whitespace-nowrap" },
    cell: (cell) => (
      <div>
        <p className="font-medium text-ink tabular-nums">{formatDateTime(cell.getValue<string>())}</p>
        <RelativeTime iso={cell.getValue<string>()} className="text-xs text-muted tabular-nums" />
      </div>
    ),
  },
  {
    id: "action",
    header: "Action",
    accessorFn: (event) => event.action,
    enableSorting: false,
    cell: (cell) => (
      <Badge tone={actionTone(cell.getValue<string>())} size="sm">
        {actionLabel(cell.getValue<string>())}
      </Badge>
    ),
  },
  {
    id: "actor",
    header: "Actor",
    accessorFn: (event) => event.actor.name,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{row.original.actor.name ?? "Unknown user"}</p>
        {row.original.actor.role ? <p className="text-xs text-muted">{roleLabel(row.original.actor.role)}</p> : null}
      </div>
    ),
  },
  {
    id: "target",
    header: "Target",
    accessorFn: (event) => event.target?.name ?? null,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.target ? (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{row.original.target.name ?? "Unknown user"}</p>
          {row.original.target.role ? <p className="text-xs text-muted">{roleLabel(row.original.target.role)}</p> : null}
        </div>
      ) : (
        <span className="text-muted">-</span>
      ),
  },
  {
    id: "request",
    header: "Request",
    accessorFn: (event) => event.path,
    enableSorting: false,
    cell: ({ row }) =>
      row.original.method || row.original.path ? (
        <div className="flex items-center gap-2 font-mono text-xs">
          {row.original.method ? (
            <span className="rounded bg-recessed px-1.5 py-0.5 font-semibold text-ink">{row.original.method}</span>
          ) : null}
          {row.original.path ? (
            <span className="max-w-[14rem] truncate text-ink-soft" title={row.original.path}>
              {row.original.path}
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-muted">-</span>
      ),
  },
  {
    id: "school",
    header: "School",
    accessorFn: (event) => event.schoolName,
    enableSorting: false,
    cell: (cell) => <span className="block max-w-[12rem] truncate">{cell.getValue<string | null>() ?? "-"}</span>,
  },
];

/** A removable "Actor: 1a2b3c4d" chip for filters that arrive through the URL. */
function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-tint pl-3 pr-1 text-xs font-semibold text-primary-ink">
      <span>
        {label}: <span className="font-mono font-medium">{value.slice(0, 8)}</span>
      </span>
      <button
        type="button"
        aria-label={`Clear ${label.toLowerCase()} filter`}
        onClick={onClear}
        className="grid size-6 place-items-center rounded-full transition-colors duration-300 hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Icon icon="solar:close-circle-linear" width={16} />
      </button>
    </span>
  );
}

export function AuditView() {
  const { filters, update } = useUrlFilters(parseAuditFilters, DEFAULTS);

  // A backwards range can only return nothing (or a 400): say so and hold the request.
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const audit = useDevAudit(
    {
      action: filters.action,
      from: filters.from,
      to: filters.to,
      actor: filters.actor,
      target: filters.target,
      page: filters.page,
      pageSize: filters.pageSize,
    },
    { enabled: !rangeInvalid },
  );

  const [selected, setSelected] = useState<DevAuditRow | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = Boolean(filters.action || filters.from || filters.to || filters.actor || filters.target);
  const clearFilters = () => update({ action: "", from: "", to: "", actor: "", target: "", page: 1 });
  const knownAction = ACTION_OPTIONS.some((option) => option.value === filters.action);

  return (
    <div className="animate-fade-up">
      <DataTable<DevAuditRow>
        manual
        searchable={false}
        columns={COLUMNS}
        data={rangeInvalid ? [] : (audit.data?.items ?? [])}
        total={rangeInvalid ? 0 : audit.data?.total}
        loading={audit.isPending && !rangeInvalid}
        page={filters.page}
        onPageChange={(page) => update({ page })}
        pageSize={filters.pageSize}
        onPageSizeChange={(pageSize) => update({ pageSize, page: 1 })}
        caption="Audit log"
        getRowId={(event) => event.id}
        onRowClick={(event) => {
          setSelected(event);
          setOpen(true);
        }}
        className={audit.isPlaceholderData ? "opacity-70 transition-opacity duration-300" : "transition-opacity duration-300"}
        filters={
          <>
            <Select
              pill
              aria-label="Filter by action"
              value={filters.action}
              onChange={(event) => update({ action: event.target.value, page: 1 })}
              className="w-full sm:w-44"
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {knownAction ? null : <option value={filters.action}>{filters.action}</option>}
            </Select>
            <label className="flex w-full items-center gap-2 text-xs font-medium text-muted sm:w-auto">
              From
              <Input
                pill
                type="date"
                aria-label="From date"
                value={filters.from}
                max={filters.to || undefined}
                invalid={rangeInvalid}
                onChange={(event) => update({ from: event.target.value, page: 1 })}
                className="sm:w-40"
              />
            </label>
            <label className="flex w-full items-center gap-2 text-xs font-medium text-muted sm:w-auto">
              To
              <Input
                pill
                type="date"
                aria-label="To date"
                value={filters.to}
                min={filters.from || undefined}
                invalid={rangeInvalid}
                onChange={(event) => update({ to: event.target.value, page: 1 })}
                className="sm:w-40"
              />
            </label>
            {filters.actor ? <FilterChip label="Actor" value={filters.actor} onClear={() => update({ actor: "", page: 1 })} /> : null}
            {filters.target ? <FilterChip label="Target" value={filters.target} onClear={() => update({ target: "", page: 1 })} /> : null}
            {filtered ? (
              <Button variant="ghost" size="sm" leftIcon="solar:close-circle-linear" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </>
        }
        toolbar={
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            leftIcon="solar:refresh-linear"
            aria-label="Refresh audit log"
            loading={audit.isFetching}
            onClick={() => void audit.refetch()}
          />
        }
        emptyState={
          rangeInvalid ? (
            <EmptyState
              icon="solar:calendar-linear"
              title="The dates are the wrong way round"
              description="The From date must be on or before the To date."
            />
          ) : audit.isError ? (
            <ErrorPanel error={audit.error} onRetry={() => void audit.refetch()} retrying={audit.isFetching} />
          ) : (
            <EmptyState
              icon="solar:history-linear"
              title={filtered ? "No events match these filters" : "No audit events yet"}
              description={
                filtered
                  ? "Try a wider date range or clear the filters."
                  : "Impersonation activity is recorded here as soon as it happens."
              }
              action={
                filtered ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      <AuditDrawer event={selected} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
