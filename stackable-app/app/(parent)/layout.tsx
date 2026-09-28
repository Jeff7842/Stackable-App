import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Parent / guardian portal (/family/*). Menu: lib/nav.ts -> NAV.parent.
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("parent");
  return <DashboardShell portal="parent">{children}</DashboardShell>;
}
