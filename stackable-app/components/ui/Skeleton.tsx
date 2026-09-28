/**
 * Skeleton - placeholder block used instead of spinners.
 *
 *   <Skeleton className="h-4 w-40" />
 *   <Skeleton className="size-10" rounded="full" />
 *
 * Design choice (documented on purpose): a flat tone (`bg-field`) that gently
 * "breathes" via opacity (`animate-shimmer`, defined in app/globals.css). It is
 * NOT a moving gradient, so the dashboard keeps its single-gradient rule.
 * Under prefers-reduced-motion it is a static tone block.
 * Decorative: aria-hidden. Put aria-busy on the loading container instead.
 * Server-component safe (no hooks).
 */
import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
  rounded?: "md" | "lg" | "xl" | "2xl" | "full";
}

const ROUNDED = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
} as const;

export function Skeleton({ className, rounded = "md" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer bg-field", ROUNDED[rounded], className)}
    />
  );
}

export default Skeleton;
