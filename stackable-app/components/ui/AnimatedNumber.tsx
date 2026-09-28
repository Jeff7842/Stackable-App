"use client";

/**
 * AnimatedNumber + useCountUp - count-up numerals for KPI cards.
 *
 *   <AnimatedNumber value={1578} />                       // 1,578
 *   <AnimatedNumber value={2005472} prefix="KES " />      // KES 2,005,472
 *   <AnimatedNumber value={4.25} decimals={2} suffix="%" />
 *
 * - Counts from 0 (or from the previous value when `value` changes) with an
 *   ease-out curve. By default it waits until the number scrolls into view.
 * - prefers-reduced-motion: shows the final number immediately, no animation.
 * - tabular-nums so digits do not jitter. Screen readers get the final value
 *   (the animating text is aria-hidden).
 * - Formatting uses a fixed "en-US" locale by default so server and client
 *   render identically (no hydration mismatch).
 *
 * Lower level: `const { value, ref } = useCountUp(target, opts)` - attach `ref`
 * to the element that should trigger the "in view" start.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { cn } from "@/lib/cn";

export interface UseCountUpOptions {
  /** Animation length in ms. Default 1000. */
  duration?: number;
  /** Start only once the element is visible. Default true. */
  startOnView?: boolean;
  /** Skip the animation entirely and return the target. */
  disabled?: boolean;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(callback: () => void) {
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/** true when the user asked for reduced motion (false on the server). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export function useCountUp(
  target: number,
  { duration = 1000, startOnView = true, disabled = false }: UseCountUpOptions = {},
): { value: number; ref: RefObject<HTMLElement | null> } {
  const ref = useRef<HTMLElement | null>(null);
  const fromRef = useRef(0);
  const [display, setDisplay] = useState(0);
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();
  const skip = reduced || disabled || !Number.isFinite(target);

  // Wait for the element to become visible.
  useEffect(() => {
    if (!startOnView || skip) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnView, skip]);

  const started = !startOnView || inView;

  // Tween from the last displayed value to the (possibly new) target.
  useEffect(() => {
    if (skip || !started) return;
    const from = fromRef.current;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, skip, started]);

  return { value: skip ? target : display, ref };
}

export interface AnimatedNumberProps {
  value: number;
  /** Fraction digits (fixed). Default 0. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  startOnView?: boolean;
  /** Thousands separators. Default true. */
  grouping?: boolean;
  /** Locale for formatting. Default "en-US" (SSR-safe). */
  locale?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration,
  startOnView,
  grouping = true,
  locale = "en-US",
  className,
}: AnimatedNumberProps) {
  const { value: shown, ref } = useCountUp(value, { duration, startOnView });

  const format = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: grouping,
    }).format(n);

  return (
    <span className={cn("tabular-nums", className)}>
      <span ref={ref} aria-hidden="true">
        {prefix}
        {format(shown)}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {format(value)}
        {suffix}
      </span>
    </span>
  );
}

export default AnimatedNumber;
