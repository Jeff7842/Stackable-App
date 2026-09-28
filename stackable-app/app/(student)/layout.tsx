import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Student / pupil portal (/learn/*). Menu: lib/nav.ts -> NAV.student.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("student");
  return <DashboardShell portal="student">{children}</DashboardShell>;
}
