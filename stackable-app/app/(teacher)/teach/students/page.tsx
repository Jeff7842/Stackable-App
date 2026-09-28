import { Suspense } from "react";
import StudentsView from "@/components/portal/teacher/StudentsView";
import { Skeleton } from "@/components/ui";

// Students the signed-in teacher is assigned to. The shell renders the page title.
// StudentsView reads the `?student=<id>` deep-link via useSearchParams, so it sits
// inside a Suspense boundary (the fallback is just a quiet table-shaped skeleton).
export default function MyStudentsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" aria-label="Loading students" className="flex flex-col gap-5">
          <Skeleton className="h-5 w-56" />
          <Skeleton rounded="2xl" className="h-96" />
        </div>
      }
    >
      <StudentsView />
    </Suspense>
  );
}
