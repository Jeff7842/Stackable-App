"use client";

/**
 * useErrorToast - show ONE error toast each time a query's `error` changes.
 *
 * Why not just put showToast in an effect: ToastProvider hands out a new
 * `showToast` function on every render, so listing it as a dependency would
 * re-fire the effect (and the toast) forever. A ref holds the latest one instead.
 */
import { useEffect, useRef } from "react";
import { useToast } from "@/components/toast/ToastProvider";

export function useErrorToast(error: unknown, title: string, fallback: string) {
  const { showToast } = useToast();
  const showRef = useRef(showToast);
  const messageRef = useRef({ title, fallback });

  useEffect(() => {
    showRef.current = showToast;
    messageRef.current = { title, fallback };
  });

  useEffect(() => {
    if (!error) return;
    const { title: t, fallback: f } = messageRef.current;
    showRef.current({
      type: "error",
      title: t,
      description: error instanceof Error && error.message ? error.message : f,
    });
  }, [error]);
}
