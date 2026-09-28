import { requireRole } from "@/lib/api/guard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Principal / manager portal (/admin). Menu: lib/nav.ts -> NAV.principal.
export default async function PrincipalLayout({ children }: { children: React.ReactNode }) {
  await requireRole("principal");
  return <DashboardShell portal="principal">{children}</DashboardShell>;
}
