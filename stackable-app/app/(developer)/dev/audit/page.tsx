import { Suspense } from "react";
import type { Metadata } from "next";
import { AuditView } from "@/components/dev/AuditView";
import { DevIntro } from "@/components/dev/DevIntro";
import { TableSkeleton } from "@/components/dev/skeletons";

export const metadata: Metadata = { title: "Audit log" };

// AuditView reads its filters from the query string (useSearchParams), which needs a Suspense boundary.
export default function DeveloperAuditPage() {
  return (
    <div className="space-y-6">
      <DevIntro subtitle="A record of every impersonation: who viewed as whom, why, and each request made while viewing." />
      <Suspense fallback={<TableSkeleton columns={6} />}>
        <AuditView />
      </Suspense>
    </div>
  );
}
