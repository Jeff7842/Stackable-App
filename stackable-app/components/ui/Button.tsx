/**
 * Button - the one custom button for the whole dashboard.
 *
 *   <Button leftIcon="solar:add-circle-linear" onClick={open}>Add student</Button>
 *   <Button variant="secondary" size="sm">Export</Button>
 *   <Button as="a" href="/dashboard/students" variant="ghost">View all</Button>
 *   <Button iconOnly leftIcon="solar:bell-linear" variant="ghost" aria-label="Notifications" />
 *   <Button loading>Saving</Button>
 *
 * Variants: primary (solid brand green) | accent (solid gold, dark text - use
 * sparingly, one per screen) | danger | secondary (surface + ghost ring) |
 * ghost (transparent, recessed on hover).
 * Feel: hover lift (-translate-y-0.5, not on ghost), active:scale-95, 300ms
 * ease-standard. `loading` shows a small spinner, sets aria-busy and disables.
 * `type` defaults to "button" so it never submits a form by accident.
 * `as="a"` renders next/link for internal hrefs (plain <a> for external,
 * mailto:, tel:, #hash). Icon-only buttons need an aria-label.
 * `ref` is a normal prop (React 19). This is a client component (it wraps
 * next/link with a click guard) but can be rendered from server pages as long
 * as you pass serializable props (use `as="a" href` for navigation there).
 */
"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ComponentPropsWithRef, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "type"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Iconify names, e.g. "solar:add-circle-linear". */
  leftIcon?: string;
  rightIcon?: string;
  /** Square, icon-only button. Provide aria-label. */
  iconOnly?: boolean;
  fullWidth?: boolean;
  as?: "button" | "a";
  href?: string;
  type?: "button" | "submit" | "reset";
  children?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-lift",
  accent:
    "bg-accent text-accent-foreground shadow-soft hover:-translate-y-0.5 hover:brightness-95 hover:shadow-lift",
  danger:
    "bg-danger-solid text-danger-foreground shadow-soft hover:-translate-y-0.5 hover:brightness-90 hover:shadow-lift",
  secondary:
    "bg-surface text-ink shadow-soft ring-1 ring-ghost hover:-translate-y-0.5 hover:ring-primary/30 hover:shadow-lift",
  ghost: "bg-transparent text-ink-soft hover:bg-recessed hover:text-ink",
};

const SIZE: Record<ButtonSize, { text: string; box: string; square: string; icon: number }> = {
  sm: { text: "gap-1.5 text-xs", box: "h-8 px-3", square: "size-8", icon: 16 },
  md: { text: "gap-2 text-sm", box: "h-10 px-4", square: "size-10", icon: 18 },
  lg: { text: "gap-2.5 text-base", box: "h-12 px-6", square: "size-12", icon: 20 },
};

function Spinner({ size }: { size: number }) {
  // Inline SVG (no network icon fetch). Static under reduced motion.
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 animate-spin motion-reduce:animate-none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Internal app links use next/link; everything else is a plain anchor. */
function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  iconOnly = false,
  fullWidth = false,
  as = "button",
  href,
  type = "button",
  disabled,
  className,
  children,
  onClick,
  ref,
  ...rest
}: ButtonProps) {
  const s = SIZE[size];
  const isDisabled = Boolean(disabled) || loading;

  const classes = cn(
    "relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-semibold",
    // Tailwind v4 lift/press use the `translate` and `scale` properties, so list them explicitly.
    "transition-[translate,scale,box-shadow,background-color,color,opacity,filter] duration-300 ease-standard",
    "active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-50",
    isDisabled && "pointer-events-none opacity-50",
    s.text,
    iconOnly ? s.square : s.box,
    fullWidth && "w-full",
    VARIANT[variant],
    className,
  );

  const content = (
    <>
      {loading ? (
        <Spinner size={s.icon} />
      ) : leftIcon ? (
        <Icon icon={leftIcon} width={s.icon} className="shrink-0" />
      ) : null}
      {iconOnly && leftIcon ? null : children}
      {rightIcon && !loading ? <Icon icon={rightIcon} width={s.icon} className="shrink-0" /> : null}
    </>
  );

  if (as === "a" && href) {
    // Anchors cannot be `disabled`: block navigation + expose aria-disabled.
    const anchorProps = rest as unknown as ComponentPropsWithoutRef<"a">;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }
      (onClick as unknown as ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined)?.(event);
    };
    const anchorCommon = {
      ...anchorProps,
      className: classes,
      "aria-disabled": isDisabled || undefined,
      "aria-busy": loading || undefined,
      tabIndex: isDisabled ? -1 : anchorProps.tabIndex,
      onClick: handleClick,
      ref: ref as unknown as Ref<HTMLAnchorElement>,
    };
    return isInternalHref(href) ? (
      <Link href={href} {...anchorCommon}>
        {content}
      </Link>
    ) : (
      <a href={href} {...anchorCommon}>
        {content}
      </a>
    );
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export default Button;
