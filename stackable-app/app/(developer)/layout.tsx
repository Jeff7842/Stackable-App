import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Developer / platform console (/dev/*, super-admin only). Menu: lib/nav.ts -> NAV.developer.
export default async function DeveloperLayout({ children }: { children: React.ReactNode }) {
  await requireRole("developer");
  return <DashboardShell portal="developer">{children}</DashboardShell>;
}
