"use client";

import { useParams } from "next/navigation";
import ChildProfile from "@/components/portal/parent/ChildProfile";

// One child's profile. The shell renders the page title ("My children"); ChildProfile owns
// the rest (header, quick facts, tabs, and the not-your-child state for a 403/404).
export default function ChildDetailPage() {
  const params = useParams();
  const studentId = typeof params?.studentId === "string" ? params.studentId : undefined;
  return <ChildProfile studentId={studentId} />;
}
