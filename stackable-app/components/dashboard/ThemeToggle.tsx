"use client";

// =============================================================================
// ThemeToggle - light / dark switch (next-themes, `.dark` class on <html>).
// -----------------------------------------------------------------------------
// Hydration-safe: which icon shows is decided by the `dark:` CSS variant (the
// class is set before hydration), and aria-pressed only appears after mount.
// The spin-in is a Web Animation, because ThemeProvider uses
// disableTransitionOnChange, which would suppress a CSS transition.
// =============================================================================

import { useRef } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useMounted } from "./hooks";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const iconRef = useRef<HTMLSpanElement>(null);

  const toggle = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    console.info("[dashboard] theme ->", next);
    setTheme(next);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      iconRef.current?.animate(
        [
          { rotate: "-90deg", scale: 0.5, opacity: 0 },
          { rotate: "0deg", scale: 1, opacity: 1 },
        ],
        { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
    }
  };

  return (
    <Button
      variant="ghost"
      iconOnly
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={mounted ? resolvedTheme === "dark" : undefined}
    >
      <span ref={iconRef} className="grid size-5 place-items-center">
        <Icon icon="solar:sun-linear" width={20} className="dark:hidden" />
        <Icon icon="solar:moon-linear" width={20} className="hidden dark:block" />
      </span>
    </Button>
  );
}

export default ThemeToggle;
