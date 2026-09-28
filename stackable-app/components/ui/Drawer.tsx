"use client";

/**
 * Drawer - right-hand slide-over for create / edit / detail flows.
 *
 *   <Drawer
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title="Add student"
 *     subtitle="Enrol a learner into a class."
 *     size="md"
 *     footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button>Save</Button></>}
 *   >
 *     ...form...
 *   </Drawer>
 *
 * Behaviour
 * - Portaled to document.body (role="dialog", aria-modal, aria-labelledby).
 * - Blurred backdrop; Esc and backdrop click close (closeOnBackdrop, default true).
 *   With stacked drawers only the top-most one reacts to Esc.
 * - Focus: first focusable element inside the panel gets focus on open (add
 *   `data-autofocus` to a field to prefer it), Tab / Shift+Tab wrap inside the
 *   panel, focus returns to the previously focused element on close.
 * - Body scroll is locked while open (previous overflow / padding restored
 *   exactly, ref-counted for stacked drawers).
 * - Enter/exit are CSS transitions (translate + opacity, 300ms ease-standard).
 *   The panel stays mounted until the exit transition has finished, so children
 *   are UNMOUNTED shortly after close. Keep form state in the parent if it must
 *   survive a close. Reduced motion collapses the transitions.
 * - Full width on phones; from the `sm` breakpoint the panel is capped by
 *   `size` (sm 420px, md 560px, lg 720px, xl 920px) or by `widthClass`
 *   (e.g. "max-w-[820px]") which overrides `size`.
 * - Header (title, subtitle, close) and the optional sticky `footer` sit on
 *   `surface`; the scrolling body sits on `canvas`. Tone shifts, no divider lines.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export type DrawerSize = "sm" | "md" | "lg" | "xl";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  size?: DrawerSize;
  children?: ReactNode;
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Tailwind max-width class overriding `size`, e.g. "max-w-[820px]". */
  widthClass?: string;
}

const SIZE: Record<DrawerSize, string> = {
  sm: "sm:max-w-[420px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[920px]",
};

/** Slightly longer than the 300ms CSS transition. */
const EXIT_MS = 320;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

/* ---- ref-counted body scroll lock (restores the exact previous values) ---- */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockScroll(): () => void {
  if (lockCount === 0) {
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    // Compensate for the vanishing scrollbar so the page does not jump.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbar}px`;
    }
    body.style.overflow = "hidden";
  }
  lockCount += 1;
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
    }
  };
}

/* ---- stack of open drawers so Esc only closes the top-most ---- */
const openStack: number[] = [];
let stackSeq = 0;

const noopSubscribe = () => () => {};

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = "md",
  children,
  className,
  closeOnBackdrop = true,
  widthClass,
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Hydration-safe "are we in the browser" (portal needs document.body).
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // mounted = in the DOM; entered = transitioned to the open position.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);

  // Keep the latest onClose without re-subscribing listeners.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Open: paint the closed position first, then transition in.
  useEffect(() => {
    if (!open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open]);

  // Close: keep mounted until the exit transition finishes.
  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  // Scroll lock for as long as the panel is in the DOM.
  useEffect(() => {
    if (!mounted) return;
    return lockScroll();
  }, [mounted]);

  // Esc (top-most only) + focus management while open.
  useEffect(() => {
    if (!open) return;

    const id = ++stackSeq;
    openStack.push(id);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || openStack[openStack.length - 1] !== id) return;
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    // Focus after the portal has rendered.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      const target = preferred ?? getFocusable(panel)[0] ?? panel;
      target.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      const index = openStack.indexOf(id);
      if (index !== -1) openStack.splice(index, 1);
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  // Tab / Shift+Tab wrap inside the panel.
  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = getFocusable(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isClient || !mounted) return null;

  const shown = open && entered;

  return createPortal(
    <div className={cn("ui-portal fixed inset-0 z-[90]", !shown && "pointer-events-none")}>
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? () => onClose() : undefined}
        className={cn(
          "absolute inset-0 bg-ink/30 backdrop-blur-sm transition-opacity duration-300 ease-standard motion-reduce:transition-none dark:bg-black/60",
          shown ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialog"}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        className={cn(
          "absolute inset-y-0 right-0 z-[95] flex w-full flex-col overflow-hidden bg-surface shadow-pop outline-none",
          "ring-1 ring-ghost sm:rounded-l-2xl",
          "transition-transform duration-300 ease-standard motion-reduce:transition-none",
          widthClass ?? SIZE[size],
          shown ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-4 bg-surface px-6 py-5">
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight text-ink">
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{subtitle}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="md"
            iconOnly
            leftIcon="solar:close-circle-linear"
            aria-label="Close"
            onClick={() => onClose()}
            className="-mr-2 shrink-0"
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-6 py-6">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 bg-surface px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default Drawer;
