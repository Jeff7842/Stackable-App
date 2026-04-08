"use client";

import { useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useTheme } from "next-themes";
import ProfileModal from "./Profile-Modal";

type NavbarProps = {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  onToggleMobileSidebar: () => void;
};

function SearchField({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[25px] border border-white bg-white shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        className="absolute left-[4px] top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-current transition-all duration-300 hover:scale-[1.06] hover:bg-[#F7F9E2] hover:text-gray-500"
        aria-label="Search dashboard"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
          <path d="M21 21l-6 -6" />
        </svg>
      </button>

      <input
        placeholder="Search anything..."
        className="w-full rounded-[27px] px-2 py-3 pl-14 font-open outline-none focus:border-black focus:outline-2 focus:outline-amber-300"
      />
    </div>
  );
}

export default function Navbar({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
}: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const dark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(dark ? "light" : "dark");
  };

  return (
    <>
      <header
        className={clsx(
          "fixed top-0 right-0 z-30 bg-[#F6F6F6]/95 backdrop-blur-sm transition-[left] duration-300",
          isSidebarCollapsed ? "lg:left-28" : "lg:left-[17rem]",
        )}
      >
        <div className="px-4 pb-4 pt-4 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:items-center xl:min-w-[260px]">
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow transition-all duration-300 hover:scale-[1.03] hover:bg-black hover:text-white lg:hidden"
                onClick={onToggleMobileSidebar}
                aria-controls="dashboard-sidebar"
                aria-expanded={isMobileSidebarOpen}
                aria-label={
                  isMobileSidebarOpen ? "Hide sidebar" : "Show sidebar"
                }
              >
                {isMobileSidebarOpen ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              <div className="min-w-0">
                <h2 className="truncate text-[22px] font-open text-black sm:text-[26px]">
                  Hello Jeff!
                </h2>
                <p className="text-[13px] text-gray-500 sm:text-[15px]">
                  23rd September 2026
                </p>
              </div>
            </div>

            <SearchField className="w-full xl:flex-1" />

            <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
              <button
                type="button"
                className="hidden h-11 w-11 items-center justify-center rounded-full bg-white p-2 transition-all duration-300 hover:scale-[1.03] hover:bg-black hover:text-gray-100 md:flex"
                aria-label="Voice input"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-microphone"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M9 5a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3l0 -5" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <path d="M8 21l8 0" />
                  <path d="M12 17l0 4" />
                </svg>
              </button>

              <button
                onClick={toggleTheme}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white transition-all duration-300 hover:scale-[1.01] hover:bg-[#d79300] hover:text-gray-50 hover:shadow-2xl active:bg-[#d7ac00] active:text-[#ffffff]"
                aria-label="Toggle dark mode"
                aria-pressed={dark}
                type="button"
                suppressHydrationWarning
              >
                {dark ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon icon-tabler icons-tabler-outline icon-tabler-moon"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon icon-tabler icons-tabler-outline icon-tabler-sun"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
                    <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-2 transition-all duration-300 hover:scale-[1.06] hover:bg-[#000000] hover:text-gray-100"
                aria-label="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-bell-dot-icon lucide-bell-dot"
                >
                  <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                  <path d="M13.916 2.314A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.74 7.327A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673 9 9 0 0 1-.585-.665" />
                  <circle cx="18" cy="8" r="3" />
                </svg>
              </button>

              <div className="relative hidden w-63 overflow-hidden rounded-[25px] border border-white bg-white md:block">
                <div className="absolute left-[2px] top-1/2 flex -translate-y-1/2 items-center justify-center transition-all duration-300 hover:scale-[1.03] hover:grayscale-70">
                  <Image
                    src="/images/5739662.jpg"
                    alt="Profile photo"
                    className="h-12 w-12 rounded-full"
                    width={500}
                    height={500}
                  />
                </div>

                <div className="mr-auto w-fit rounded-[27px] px-2 py-2 pl-15">
                  <h2 className="text-[15px] font-body font-[600]">
                    Jefferson Kimotho
                  </h2>
                  <p className="text-[12px]">Super Admin</p>
                </div>

                <button
                  id="user-arrow"
                  onClick={() => setOpen(true)}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 transition-all duration-300 hover:scale-[1.04] hover:bg-black hover:text-white"
                  type="button"
                  aria-label="Open profile menu"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M9 6l6 6l-6 6" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white bg-white shadow-sm transition-all duration-300 hover:scale-[1.03] md:hidden"
                aria-label="Open profile menu"
              >
                <Image
                  src="/images/5739662.jpg"
                  alt="Profile photo"
                  className="h-full w-full rounded-full object-cover"
                  width={500}
                  height={500}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 border-b border-gray-300" />
        </div>
      </header>

      <div className="relative flex w-full">
        <ProfileModal open={open} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
