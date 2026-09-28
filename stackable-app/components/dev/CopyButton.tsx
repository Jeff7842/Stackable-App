"use client";

// CopyButton - small icon button that copies a value and confirms with a check.
// Clipboard access can be blocked (insecure origin, permissions), so failures are
// caught and reported with a toast instead of throwing.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast/ToastProvider";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.warn("[dev] clipboard unavailable", error);
      showToast({ type: "error", title: "Could not copy", description: "Your browser blocked clipboard access." });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      leftIcon={copied ? "solar:check-circle-bold" : "solar:copy-linear"}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={() => void copy()}
      className={copied ? "text-success" : undefined}
    />
  );
}
