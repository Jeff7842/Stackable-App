import type { Metadata } from "next";
import { IntegrationsView } from "@/components/dev/IntegrationsView";

export const metadata: Metadata = { title: "Integrations" };

export default function DeveloperIntegrationsPage() {
  return <IntegrationsView />;
}
