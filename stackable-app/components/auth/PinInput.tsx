"use client";

import { Fragment, useRef, useState } from "react";

type PinInputProps = {
  length?: number;
  /** A hyphen is drawn after every `groupSize` boxes (3 -> "123-456"). */
  groupSize?: number;
  disabled?: boolean;
  /** Red state; the parent also remounts (key) to clear the boxes after a wrong code. */
  error?: boolean;
  autoFocus?: boolean;
  /** Fires on every change with the digits typed so far. */
  onChange?: (value: string) => void;
  /** Fires whenever ALL boxes are filled - including after editing one box of a full code. */
  onComplete?: (value: string) => void;
};

/**
 * OTP-style boxes. Type, paste a whole code, backspace, use the arrow keys, or click any
 * box and change just that digit. The parent decides what "complete" means.
 */
export default function PinInput({
  length = 6,
  groupSize = 3,
  disabled,
  error,
  autoFocus,
  onChange,
  onComplete,
}: PinInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[]) => {
    setDigits(next);
    const value = next.join("");
    onChange?.(value);
    if (next.every(Boolean)) onComplete?.(value);
  };

  // Put a run of digits into the boxes starting at `from` (used by paste and autofill).
  const fill = (from: number, raw: string) => {
    const incoming = raw.replace(/\D/g, "");
    if (!incoming) return;
    const next = [...digits];
    // A full code pasted anywhere replaces everything.
    const start = incoming.length >= length ? 0 : from;
    incoming
      .slice(0, length - start)
      .split("")
      .forEach((d, k) => (next[start + k] = d));
    commit(next);
    focus(Math.min(start + incoming.length, length - 1));
  };

  const onInput = (i: number, raw: string) => {
    let only = raw.replace(/\D/g, "");
    // Typing over a filled box (no selection) gives old+new digit: keep just the new one.
    if (digits[i] && only.length === 2) only = only.replace(digits[i], "");
    if (only.length > 1) return fill(i, only); // autofill / a pasted run
    const next = [...digits];
    next[i] = only;
    commit(next);
    if (only && i < length - 1) focus(i + 1);
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        commit(next);
      } else if (i > 0) {
        next[i - 1] = "";
        commit(next);
        focus(i - 1);
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      const next = [...digits];
      next[i] = "";
      commit(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${length}-digit verification code`}
      className={`flex items-center justify-center gap-2 sm:gap-3 ${error ? "animate-shake" : ""}`}
    >
      {digits.map((digit, i) => (
        <Fragment key={i}>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={length} // lets a pasted/autofilled code arrive whole; onInput trims it
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData("text"));
            }}
            className={`size-11 sm:size-12 rounded-lg border text-center text-xl font-semibold text-black outline-none transition duration-200 focus:ring-1 focus:outline-2 focus:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none ${
              error
                ? "border-red-500 text-red-600 focus:ring-[#f93333] focus:outline-[#ff6565be]"
                : "border-gray-300 focus:ring-[#f9ce33] focus:outline-[#ffe565be]"
            }`}
          />
          {groupSize > 0 && (i + 1) % groupSize === 0 && i < length - 1 && (
            <span aria-hidden="true" className="text-xl font-semibold text-gray-400 select-none">
              -
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
