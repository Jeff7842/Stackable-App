// Loading skeleton for the grades page: header line, four summary tiles, insights row,
// table block. Matches GradesView so nothing jumps when the data arrives.

import { Skeleton } from "@/components/ui";

export function GradesSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading your grades" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-56 max-w-full" />
        <Skeleton rounded="xl" className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} rounded="2xl" className="h-[5.5rem]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton rounded="2xl" className="h-64" />
        <Skeleton rounded="2xl" className="h-64" />
      </div>
      <Skeleton rounded="2xl" className="h-96" />
      <span className="sr-only">Loading your grades</span>
    </div>
  );
}
