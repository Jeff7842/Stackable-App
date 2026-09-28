// Loading skeletons for the parent portal: the family home, the children list and the
// child profile. Each mirrors its real layout so nothing jumps when the data arrives.
// Skeletons breathe via opacity only (no shimmer gradient).

import { Skeleton } from "@/components/ui";

function PanelSkeleton({ rows, rowHeight = "h-14" }: { rows: number; rowHeight?: string }) {
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

function ChildCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <div className="flex items-center gap-3.5">
        <Skeleton rounded="full" className="size-14" />
        <div className="flex-1">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      </div>
      <Skeleton rounded="xl" className="h-44" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton rounded="xl" className="h-16" />
        <Skeleton rounded="xl" className="h-16" />
      </div>
      <Skeleton rounded="xl" className="h-10" />
    </div>
  );
}

export function FamilyHomeSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading your family dashboard"
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

        <div>
          <Skeleton className="mb-4 h-5 w-36" />
          <div className="grid gap-4 md:grid-cols-2">
            <ChildCardSkeleton />
            <ChildCardSkeleton />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <PanelSkeleton rows={3} />
        <PanelSkeleton rows={2} rowHeight="h-10" />
      </div>
      <span className="sr-only">Loading your family dashboard</span>
    </div>
  );
}

export function ChildrenListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your children" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton rounded="xl" className="h-8 w-24" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} rounded="2xl" className="h-[5.5rem] sm:h-20" />
      ))}
      <span className="sr-only">Loading your children</span>
    </div>
  );
}

export function ChildProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading child profile" className="flex flex-col gap-5">
      <Skeleton rounded="xl" className="h-8 w-32" />
      <div className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
        <div className="flex items-center gap-4">
          <Skeleton rounded="full" className="size-20" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="mt-2 h-4 w-40" />
            <Skeleton rounded="full" className="mt-3 h-6 w-24" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} rounded="2xl" className="h-28" />
        ))}
      </div>
      <Skeleton rounded="xl" className="h-11 w-full max-w-sm" />
      <Skeleton rounded="2xl" className="h-72" />
      <span className="sr-only">Loading child profile</span>
    </div>
  );
}
