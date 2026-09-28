/** Status chip for a student (students.status). Server-safe (no hooks). */
import { Badge } from "@/components/ui";
import type { StudentStatus } from "@/hooks/useStudents";
import { STATUS_LABEL, STATUS_TONE } from "./utils";

export function StudentStatusBadge({ status }: { status: string }) {
  const known = status as StudentStatus;
  return (
    <Badge tone={STATUS_TONE[known] ?? "neutral"} dot>
      {STATUS_LABEL[known] ?? status}
    </Badge>
  );
}

export default StudentStatusBadge;
