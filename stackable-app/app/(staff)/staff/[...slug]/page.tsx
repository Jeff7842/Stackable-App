import { ComingSoon } from "@/components/ui";
import { prettifySegment } from "@/lib/nav";

// Every unbuilt /staff page shows the same placeholder; remove a route's tag in lib/nav.ts when it is built.
export default async function StaffComingSoonPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <ComingSoon title={prettifySegment(slug[slug.length - 1] ?? "")} />;
}
