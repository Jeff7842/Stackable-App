import type { Metadata } from "next";
import { OverviewView } from "@/components/dev/OverviewView";

export const metadata: Metadata = { title: "Platform overview" };

// The Navbar in DashboardShell renders the page <h1>; the view starts with a greeting <h2>.
export default function DeveloperOverviewPage() {
  return <OverviewView />;
}
