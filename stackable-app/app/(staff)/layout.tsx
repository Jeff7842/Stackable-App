import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Staff portal (/staff/*) for finance, secretary and driver. Menu: lib/nav.ts -> NAV.staff.
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRole("staff");
  return <DashboardShell portal="staff">{children}</DashboardShell>;
}
