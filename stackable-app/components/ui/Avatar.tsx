"use client";

/**
 * Avatar - photo with an initials fallback on a soft primary-tint disc.
 *
 *   <Avatar name="Amina Otieno" src={user.image} size="md" status="online" />
 *
 * - Falls back to initials when `src` is empty OR the image fails to load.
 * - `status` adds a dot bottom-right; "online" uses the live ping animation.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "away" | "busy" | "offline";

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

const SIZE: Record<AvatarSize, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
};

const DOT_SIZE: Record<AvatarSize, string> = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
  xl: "size-3.5",
};

const DOT_COLOR: Record<AvatarStatus, string> = {
  online: "bg-success",
  away: "bg-warning",
  busy: "bg-danger",
  offline: "bg-muted",
};

function getInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
  // Remember which src failed so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      role="img"
      aria-label={[name || "Avatar", status].filter(Boolean).join(", ")}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-full bg-primary-tint font-display font-semibold text-primary-ink select-none",
          SIZE[size],
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatars come from arbitrary hosts
          <img
            src={src as string}
            alt=""
            className="size-full object-cover"
            onError={() => setFailedSrc(src ?? null)}
          />
        ) : (
          <span aria-hidden="true">{getInitials(name)}</span>
        )}
      </span>

      {status ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute right-0 bottom-0 inline-flex rounded-full ring-2 ring-surface",
            DOT_SIZE[size],
          )}
        >
          {status === "online" ? (
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-pulse-dot",
                DOT_COLOR[status],
              )}
            />
          ) : null}
          <span className={cn("relative size-full rounded-full", DOT_COLOR[status])} />
        </span>
      ) : null}
    </span>
  );
}

export default Avatar;
