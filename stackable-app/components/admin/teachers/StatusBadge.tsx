/** Status chip for a teacher (teachers.status). Server-safe (no hooks). */
import { Badge } from "@/components/ui";
import type { TeacherStatus } from "@/hooks/useTeachers";
import { STATUS_LABEL, STATUS_TONE } from "./utils";

export function TeacherStatusBadge({ status }: { status: string }) {
  const known = status as TeacherStatus;
  return (
    <Badge tone={STATUS_TONE[known] ?? "neutral"} dot>
      {STATUS_LABEL[known] ?? status}
    </Badge>
  );
}

export default TeacherStatusBadge;
