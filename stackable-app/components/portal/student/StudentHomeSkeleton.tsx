// Loading skeleton for the student home. Mirrors the real layout (welcome card, KPI strip,
// progress + subjects in the main column, timetable / grades / links in the right rail)
// so nothing jumps when the data arrives. Skeletons breathe via opacity only.

import { Skeleton } from "@/components/ui";

function PanelSkeleton({ rows, rowHeight = "h-16" }: { rows: number; rowHeight?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3 w-56 max-w-full" />
      <div className="mt-5 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} rounded="xl" className={rowHeight} />
        ))}
      </div>
    </div>
  );
}

export function StudentHomeSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your dashboard"
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <div className="rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost sm:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <Skeleton rounded="full" className="h-6 w-20" />
              <Skeleton className="mt-4 h-8 w-64 max-w-full" />
              <Skeleton className="mt-3 h-4 w-72 max-w-full" />
            </div>
            <Skeleton rounded="xl" className="h-24 w-full md:w-64" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
              <Skeleton rounded="full" className="size-10" />
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-8 w-16" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <Skeleton className="h-5 w-48" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Skeleton rounded="xl" className="h-56" />
            <Skeleton rounded="xl" className="h-56" />
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} rounded="2xl" className="h-[4.75rem]" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={2} rowHeight="h-10" />
      </div>
      <span className="sr-only">Loading your dashboard</span>
    </div>
  );
}
