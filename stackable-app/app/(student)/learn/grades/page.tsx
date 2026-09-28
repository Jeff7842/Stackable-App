import { Suspense } from "react";
import GradesView from "@/components/portal/student/GradesView";
import { GradesSkeleton } from "@/components/portal/student/GradesSkeleton";

// The signed-in student's grades. The shell renders the page title. GradesView reads the
// `?subject=<name>` deep-link (from the home page's subject tiles) via useSearchParams,
// so it sits inside a Suspense boundary whose fallback is the page's own skeleton.
export default function StudentGradesPage() {
  return (
    <Suspense fallback={<GradesSkeleton />}>
      <GradesView />
    </Suspense>
  );
}
