import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// School admin workspace (/dashboard/*). Menu: lib/nav.ts -> NAV.dashboard.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole("dashboard");
  return <DashboardShell portal="dashboard">{children}</DashboardShell>;
}
