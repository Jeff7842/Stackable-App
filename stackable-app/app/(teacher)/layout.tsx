import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Teacher / staff portal (/teach/*). Menu: lib/nav.ts -> NAV.teacher.
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await requireRole("teacher");
  return <DashboardShell portal="teacher">{children}</DashboardShell>;
}
