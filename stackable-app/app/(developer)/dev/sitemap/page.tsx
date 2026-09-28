import type { Metadata } from "next";
import { SitemapView } from "@/components/dev/SitemapView";

export const metadata: Metadata = { title: "Sitemap" };

export default function DeveloperSitemapPage() {
  return <SitemapView />;
}
