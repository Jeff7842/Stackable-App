import type { Metadata } from "next";
import { DevIntro } from "@/components/dev/DevIntro";
import { SchoolsView } from "@/components/dev/SchoolsView";

export const metadata: Metadata = { title: "Schools" };

export default function DeveloperSchoolsPage() {
  return (
    <div className="space-y-6">
      <DevIntro subtitle="Every school on the platform. Select a row for its details and a shortcut to its users." />
      <SchoolsView />
    </div>
  );
}
