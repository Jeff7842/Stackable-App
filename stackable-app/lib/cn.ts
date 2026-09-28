import { clsx, type ClassValue } from "clsx";

/**
 * Thin clsx wrapper used by every component in components/ui.
 * (tailwind-merge is intentionally NOT installed: later classes do not
 * override earlier conflicting ones, so components expose variants instead
 * of relying on className overrides for the same property.)
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
