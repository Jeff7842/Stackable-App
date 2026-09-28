import type { CSSProperties } from "react";

/**
 * Staggered entrance: pair with the `animate-fade-up` utility (it uses fill-mode
 * "both", so the element stays hidden until its delay elapses). Reduced motion
 * switches the animation off globally (app/globals.css).
 */
export function stagger(index: number, stepMs = 60): CSSProperties {
  return { animationDelay: `${Math.min(index, 12) * stepMs}ms` };
}
