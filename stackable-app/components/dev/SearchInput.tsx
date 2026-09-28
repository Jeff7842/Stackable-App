"use client";

// SearchInput - the search pill for URL-driven tables. DataTable's built-in search
// cannot start with a value, so a page whose filters come from the URL renders this
// in the `filters` slot (with `searchable={false}`) instead.
//
// The text is local while typing and is committed 300ms after the last keystroke.
// `value` is the committed value (from the URL); the box follows it when it changes
// from elsewhere (for example the sidebar link that clears the filters).

import { useEffect, useRef, useState } from "react";
import { Icon, Input } from "@/components/ui";

export function SearchInput({
  value,
  onCommit,
  placeholder = "Search",
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // What WE last sent up. The URL echoes it back a moment later; that echo must not
  // overwrite keystrokes typed in the meantime.
  const [sent, setSent] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // The committed value changed under us (link, back button): follow it, unless it
  // is just our own commit coming back.
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setDraft(value);
    }
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (next: string) => {
    setSent(next);
    onCommit(next);
  };

  const change = (next: string) => {
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(next.trim()), 300);
  };

  const clear = () => {
    window.clearTimeout(timer.current);
    setDraft("");
    commit("");
  };

  return (
    <Input
      pill
      type="search"
      autoComplete="off"
      leftIcon="solar:magnifer-linear"
      placeholder={placeholder}
      aria-label={placeholder}
      value={draft}
      onChange={(event) => change(event.target.value)}
      className={className ?? "sm:max-w-xs"}
      inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
      rightAdornment={
        draft ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="grid size-5 place-items-center rounded-full text-muted transition-colors duration-300 hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Icon icon="solar:close-circle-bold" width={16} />
          </button>
        ) : null
      }
    />
  );
}
