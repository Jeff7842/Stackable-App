/**
 * Shared class recipes for Input / Select / Textarea (internal, not exported
 * from the barrel). One shell so every form control looks and behaves alike:
 *  - resting: tonal `field` fill, no border
 *  - focus:   fill lifts to `surface` + focus ring
 *  - error:   danger ring
 */
import { cn } from "@/lib/cn";

export type ControlSize = "sm" | "md" | "lg";

export const CONTROL_HEIGHT: Record<ControlSize, string> = {
  sm: "h-8 text-xs",
  md: "h-10 text-sm",
  lg: "h-12 text-base",
};

export const CONTROL_PAD: Record<ControlSize, string> = {
  sm: "px-2.5",
  md: "px-3",
  lg: "px-4",
};

export const ICON_PX: Record<ControlSize, number> = { sm: 16, md: 18, lg: 20 };

/** Wrapper (the visible "box"). */
export function controlShell({
  invalid,
  pill,
  multiline,
  className,
}: {
  invalid?: boolean;
  pill?: boolean;
  multiline?: boolean;
  className?: string;
}) {
  return cn(
    "group/control relative flex w-full gap-2 bg-field text-ink",
    multiline ? "items-stretch" : "items-center",
    "transition-[background-color,box-shadow] duration-300 ease-standard",
    pill ? "rounded-full" : "rounded-lg",
    invalid
      ? "ring-2 ring-danger/70 focus-within:bg-surface focus-within:ring-danger"
      : "ring-1 ring-transparent hover:ring-ghost focus-within:bg-surface focus-within:ring-2 focus-within:ring-focus",
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
    className,
  );
}

/** The bare native element inside the shell. */
export const CONTROL_INNER =
  "min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed";
