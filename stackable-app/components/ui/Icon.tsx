"use client";

/**
 * Icon - thin wrapper over Iconify's web component (`@iconify-icon/react`).
 *
 * Why a wrapper: it is a client boundary, so server components (ComingSoon,
 * EmptyState, PageHeader ...) can render icons safely, and it applies the
 * dashboard defaults (20px, decorative aria-hidden).
 *
 * ONE icon set for the whole dashboard: Solar. Use the `-linear` style by
 * default and the `-bold` style for active / filled states, e.g.
 *   <Icon icon="solar:home-2-linear" />   <Icon icon="solar:home-2-bold" />
 * Iconify silently renders NOTHING for a wrong name - validate new names
 * against https://api.iconify.design/solar.json?icons=a,b,c (see `not_found`).
 */
import { Icon as IconifyIcon, type IconifyIconProps } from "@iconify-icon/react";

export type IconProps = Omit<IconifyIconProps, "icon" | "ref"> & {
  /** Iconify name, e.g. "solar:home-2-linear". */
  icon: string;
};

export function Icon({ icon, width = 20, ...rest }: IconProps) {
  const decorative = !rest["aria-label"] && !rest["aria-labelledby"];
  return (
    <IconifyIcon
      icon={icon}
      width={width}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    />
  );
}

export default Icon;
