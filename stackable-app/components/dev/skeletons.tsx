/**
 * Loading skeletons shaped like the real content (no spinners). Flat tone blocks
 * that breathe via opacity (see Skeleton). Server-component safe.
 */
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6"] as const;

/** A table card: toolbar pill, header band, rows, footer. Used as the Suspense fallback of the URL-driven pages. */
export function TableSkeleton({ rows = 8, columns = 6, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div aria-busy="true" aria-label="Loading" className={cn("overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-ghost", className)}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <Skeleton rounded="full" className="h-10 w-full sm:max-w-xs" />
        <Skeleton rounded="full" className="h-10 w-full sm:w-40" />
        <Skeleton rounded="full" className="h-10 w-full sm:w-40" />
      </div>
      <div className="bg-recessed px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 px-4 py-3.5 odd:bg-surface even:bg-recessed/50">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", WIDTHS[(r + c) % WIDTHS.length])} />
          ))}
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-8 w-40" rounded="lg" />
      </div>
    </div>
  );
}

/** Overview: greeting, 4 KPI cards, health grid, role donut, activity list. */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading platform overview" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} rounded="2xl" className="h-[8.5rem]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton rounded="2xl" className="h-32 sm:col-span-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} rounded="2xl" className="h-32" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <Skeleton className="h-5 w-32" />
            <Skeleton rounded="full" className="mx-auto size-40" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton rounded="full" className="size-8 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Integrations: six status cards. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <div className="flex items-center gap-3">
            <Skeleton rounded="xl" className="size-11 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton rounded="full" className="h-6 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Settings: one card of label / value rows. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-1 rounded-2xl bg-surface p-3 shadow-soft ring-1 ring-ghost">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3.5 odd:bg-recessed/60">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
