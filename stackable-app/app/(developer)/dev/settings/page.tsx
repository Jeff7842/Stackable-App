import type { Metadata } from "next";
import { SettingsView } from "@/components/dev/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function DeveloperSettingsPage() {
  return <SettingsView />;
}
