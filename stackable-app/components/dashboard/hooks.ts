"use client";

// =============================================================================
// Small client hooks shared by the dashboard shell.
// -----------------------------------------------------------------------------
// All of them are hydration-safe: the server snapshot is a fixed value, so the
// first client render matches the server HTML exactly, and React then swaps in
// the real browser value. No setState-in-effect, no mismatch warnings.
// =============================================================================

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** false on the server and during hydration, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * false for the first two animation frames after mount, then true.
 * Used to switch width transitions on only AFTER the persisted sidebar state
 * has been applied, so a collapsed sidebar does not visibly animate on load.
 */
export function useTransitionsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
  return ready;
}

// ---------------------------------------------------------------------------
// Persisted boolean (localStorage) as an external store.
// Every access is wrapped in try/catch: storage can throw (private mode,
// blocked site data) and the UI must keep working without it.
// ---------------------------------------------------------------------------
const FLAG_EVENT = "stackable:flag";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch (error) {
    console.warn("[dashboard] localStorage unavailable (read)", error);
    return false;
  }
}

/**
 * useLocalFlag("key") -> [value, setValue].
 * Server + first client render: false. Then the stored value.
 * If storage is unavailable the flag still works for the current page view
 * (it is kept in an in-memory map), it just is not remembered.
 */
const memoryFlags = new Map<string, boolean>();

export function useLocalFlag(key: string): [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) {
          memoryFlags.delete(key); // another tab changed it: the stored value wins again
          onChange();
        }
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(FLAG_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(FLAG_EVENT, onChange);
      };
    },
    [key],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => (memoryFlags.has(key) ? (memoryFlags.get(key) as boolean) : readFlag(key)),
    () => false,
  );

  const setValue = useCallback(
    (next: boolean) => {
      memoryFlags.set(key, next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch (error) {
        console.warn("[dashboard] localStorage unavailable (write)", error);
      }
      window.dispatchEvent(new Event(FLAG_EVENT));
    },
    [key],
  );

  return [value, setValue];
}

/** "Ctrl K" or the Mac command glyph, without a hydration mismatch. */
export function useShortcutLabel(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘ K" : "Ctrl K"),
    () => "Ctrl K",
  );
}

/** True once the page has scrolled past `offset` px (drives the header tone shift). */
export function useScrolled(offset = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // A restored scroll position fires a scroll event, so no initial read is needed.
    const onScroll = () => setScrolled(window.scrollY > offset);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}
