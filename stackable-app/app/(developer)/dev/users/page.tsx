import { Suspense } from "react";
import type { Metadata } from "next";
import { DevIntro } from "@/components/dev/DevIntro";
import { TableSkeleton } from "@/components/dev/skeletons";
import { UsersView } from "@/components/dev/UsersView";

export const metadata: Metadata = { title: "Users" };

// UsersView reads its filters from the query string (useSearchParams), which needs a Suspense boundary.
export default function DeveloperUsersPage() {
  return (
    <div className="space-y-6">
      <DevIntro subtitle="Find people across every school and, when you need to, view the app as them. Each session is recorded." />
      <Suspense fallback={<TableSkeleton />}>
        <UsersView />
      </Suspense>
    </div>
  );
}
