// Role and status chips for users. Thin wrappers around the shared Badge so the
// role / status -> tone mapping lives in exactly one place.

import { Badge, type BadgeTone } from "@/components/ui";
import type { Role, UserStatus } from "@/lib/validation/shared";
import { ROLE_LABEL, STATUS_LABEL } from "./userUtils";

// Gold is reserved for the rarest role (the one thing to look at).
const ROLE_TONE: Record<Role, BadgeTone> = {
  "super-admin": "gold",
  admin: "info",
  manager: "neutral",
  teacher: "success",
  student: "warning",
  pupil: "warning",
  parent: "neutral",
  staff: "neutral",
  "dept-head": "success",
  finance: "info",
  secretary: "neutral",
  driver: "neutral",
};

export function RoleBadge({ role, size = "md" }: { role: Role; size?: "sm" | "md" }) {
  return (
    <Badge tone={ROLE_TONE[role] ?? "neutral"} size={size}>
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

export function StatusBadge({ status, size = "md" }: { status: UserStatus; size?: "sm" | "md" }) {
  // "active" gets the live pinging dot from Badge; the others a static dot.
  return (
    <Badge tone={status} dot size={size}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

/** "Required" / "Cleared" chip for users.must_change_password. */
export function PasswordBadge({ required, size = "md" }: { required: boolean; size?: "sm" | "md" }) {
  return (
    <Badge tone={required ? "warning" : "success"} size={size}>
      {required ? "Required" : "Cleared"}
    </Badge>
  );
}
