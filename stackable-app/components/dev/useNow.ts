"use client";

// =============================================================================
// useNow - a shared "current time" that ticks every 30s, so relative times
// ("5 min ago") stay honest without every row owning a timer.
// -----------------------------------------------------------------------------
// Built on useSyncExternalStore: one interval for the whole page, started by the
// first subscriber and stopped when the last one leaves. Returns 0 on the server
// / during hydration; formatRelative() falls back to a plain date for 0, and
// relative times are only rendered from client-fetched data anyway.
// =============================================================================

import { useSyncExternalStore } from "react";

const TICK_MS = 30_000;

const listeners = new Set<() => void>();
let current = 0;
let timer: number | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) {
    current = Date.now();
    timer = window.setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  if (current === 0) current = Date.now();
  return current;
}

const getServerSnapshot = () => 0;

/** Epoch milliseconds, refreshed every 30 seconds. 0 until the client has mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
