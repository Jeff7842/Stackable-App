/**
 * Badge - tinted chip for statuses AND roles.
 *
 *   <Badge tone="active" dot>Active</Badge>
 *   <Badge tone="gold" icon="solar:crown-linear">Principal</Badge>
 *
 * Tones: active | pending | suspended | success | warning | error | info |
 *        neutral | gold. The "active" dot pings (live status dot); every other
 *        dot is static. Colours come from tokens only (works in light + dark).
 * Server-component safe (no hooks).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type BadgeTone =
  | "active"
  | "pending"
  | "suspended"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "gold";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Show a leading status dot. */
  dot?: boolean;
  size?: "sm" | "md";
  /** Iconify name, e.g. "solar:shield-check-linear". */
  icon?: string;
  className?: string;
  children?: ReactNode;
}

// chip = background + text colour, dot = dot colour
const TONE: Record<BadgeTone, { chip: string; dot: string }> = {
  active: { chip: "bg-success-tint text-success", dot: "bg-success" },
  success: { chip: "bg-success-tint text-success", dot: "bg-success" },
  pending: { chip: "bg-recessed text-ink-soft", dot: "bg-warning" },
  warning: { chip: "bg-warning-tint text-warning", dot: "bg-warning" },
  suspended: { chip: "bg-danger-tint text-danger", dot: "bg-danger" },
  error: { chip: "bg-danger-tint text-danger", dot: "bg-danger" },
  info: { chip: "bg-info-tint text-info", dot: "bg-info" },
  neutral: { chip: "bg-recessed text-ink-soft", dot: "bg-muted" },
  gold: { chip: "bg-accent-tint text-accent-ink", dot: "bg-accent" },
};

const SIZE = {
  sm: { chip: "gap-1 px-2 py-0.5 text-[11px] leading-4", dot: "size-1.5", icon: 12 },
  md: { chip: "gap-1.5 px-2.5 py-1 text-xs leading-4", dot: "size-2", icon: 14 },
} as const;

export function Badge({
  tone = "neutral",
  dot = false,
  size = "md",
  icon,
  className,
  children,
}: BadgeProps) {
  const t = TONE[tone];
  const s = SIZE[size];

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full font-semibold",
        t.chip,
        s.chip,
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("relative inline-flex shrink-0", s.dot)}>
          {tone === "active" ? (
            <span className={cn("absolute inset-0 rounded-full animate-pulse-dot", t.dot)} />
          ) : null}
          <span className={cn("relative size-full rounded-full", t.dot)} />
        </span>
      ) : null}
      {icon ? <Icon icon={icon} width={s.icon} /> : null}
      {children}
    </span>
  );
}

export default Badge;
