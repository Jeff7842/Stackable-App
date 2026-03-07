"use client";

import { useState } from "react";
import React from "react";

interface DropdownProps {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
}

export default function Dropdown({ label, items }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">

      {/* BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center
        bg-brand hover:bg-brand-strong
        text-white shadow-xs
        font-medium rounded-base
        text-sm px-4 py-2.5
        focus:ring-4 focus:ring-brand-medium"
      >
        {label}
        <svg className="w-4 h-4 ms-1.5" viewBox="0 0 24 24" fill="none">
          <path d="m19 9-7 7-7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* MENU */}
      {open && (
        <div className="absolute z-20 mt-2 w-44
        bg-neutral-primary-medium
        border border-default-medium
        rounded-base shadow-lg">

          <ul className="p-2 text-sm text-body font-medium">

            {items.map((item, i) => (
              <li key={i}>
                <button
                  className="inline-flex w-full p-2 rounded
                  hover:bg-neutral-tertiary-medium
                  hover:text-heading"
                >
                  {item.label || item}
                </button>
              </li>
            ))}

          </ul>

        </div>
      )}

    </div>
  );
}
