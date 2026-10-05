import { Skeleton } from "@/components/ui";

// Shown while a portal page loads: a title bar, a row of tiles and a list.
export default function PortalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" rounded="xl" />
        ))}
      </div>
      <Skeleton className="h-64" rounded="xl" />
    </div>
  );
}
