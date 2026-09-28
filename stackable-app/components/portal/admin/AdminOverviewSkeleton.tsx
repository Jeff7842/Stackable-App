// Loading skeleton for the admin overview. Mirrors the real layout (greeting,
// 5 KPI cards, main column, right rail). Opacity-only breathing, no gradients.

import { Skeleton } from "@/components/ui";

function Block({ h, className }: { h: string; className?: string }) {
  return (
    <div className={`rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost ${className ?? ""}`}>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="mt-2 h-3 w-60 max-w-full" />
      <Skeleton rounded="xl" className={`mt-5 w-full ${h}`} />
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the school overview" className="flex flex-col gap-6">
      <div className="rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost sm:p-7">
        <Skeleton rounded="full" className="h-6 w-24" />
        <Skeleton className="mt-4 h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="col-span-1 flex flex-col gap-5 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost last:col-span-2 lg:last:col-span-1"
          >
            <Skeleton rounded="full" className="size-10" />
            <div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Block h="h-64" />
            <Block h="h-64" />
          </div>
          <Block h="h-72" />
          <Block h="h-56" />
        </div>
        <Block h="h-[28rem]" />
      </div>
      <span className="sr-only">Loading the school overview</span>
    </div>
  );
}
