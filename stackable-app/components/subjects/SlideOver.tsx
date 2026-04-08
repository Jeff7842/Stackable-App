"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { classNames } from "@/lib/subjects";

type SubjectSlideOverProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
};

export default function SubjectSlideOver({
  open,
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-[820px]",
}: SubjectSlideOverProps) {
  return (
    <>
      <div
        className={classNames(
          "fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-[5px] transition-all duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={classNames(
          "fixed inset-y-0 right-0 z-[95] w-full transform bg-transparent transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className={classNames("ml-auto h-full w-full", widthClass)}>
          <div className="flex h-full flex-col border-l border-gray-200 bg-[#F8FAFC] shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-[24px] font-bold tracking-tight text-gray-900">
                  {title}
                </h2>
                {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
