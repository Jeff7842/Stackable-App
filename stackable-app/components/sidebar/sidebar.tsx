"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

type SidebarLinkProps = {
  href: string;
  children: React.ReactNode;
};

function SidebarLink({ href, children }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2 w-full px-3 py-2 text-[14px] rounded-[20px]",
        "transition-colors duration-200",
        "hover:bg-gray-100",
        isActive && "bg-[#F7F9E2] text-[#F19F24] font-medium",
      )}
    >
      {children}
    </Link>
  );
}

function SidebarTopLink({ href, children }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2 w-full px-3 py-2 mt-[-15px] mb-[-15px] text-[14px] rounded-[20px]",
        "transition-colors duration-200",
        "hover:bg-gray-100",
        isActive && "bg-[#e4f9e2] text-[#007146] font-medium",
      )}
    >
      {children}
    </Link>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const isOpen = (key: string) => openKey === key;

  return (
    <aside className="w-64 md:none h-[98.4%] z-15 translate-y-[5px] translate-x-[5px] bg-[#fffefb] shadow-[0_35px_35px_rgba(0,0,0,0.15)] inset-shadow-sm inset-shadow-gray-200 border border-white rounded-[30px] fixed left-0 top-0 overflow-hidden">
      <div
        className="h-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-300
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb]:bg-[#F19F24]
    dark:[&::-webkit-scrollbar-track]:bg-neutral-400
    dark:[&::-webkit-scrollbar-thumb]:bg-[#007146]"
      >
        <div className="fixed z-10 w-full bg-white">
          <div className="flex justify-between items-center align-middle gap-3 mt-0">
            <div className="p-4 font-bold text-xl flex items-center justify-center">
              <Image
                src="/logos/Symbol Light.webp"
                alt="school-logo"
                className="w-[45px]"
                width={500}
                height={500}
              />
            </div>

            <div className="rounded-full w-10 h-10 border-1 border-gray-200 hover:border-black bg-[#f9f7f7] shadow-lg p-2 mr-4 mt-0 cursor-pointer  justify-center flex items-center hover:scale-[1.05] text-black hover:bg-black hover:text-white hover:text-[20px] hover:translate-y-[-2px] transition-[300ms]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.95"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left justify-center align-middle flex items-center transition"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M15 6l-6 6l6 6" />
              </svg>
            </div>
          </div>
          <div className="grow border-t border-gray-300 mb-3.25 w-[93%] flex ml-[7px]"></div>
        </div>

 {/* MY settings Navigation */}
        <nav className="flex flex-col gap-2 px-4 mt-25">
          <ul>
            <li className="mt-3 mb-3">
              <SidebarTopLink href="/dashboard/settings">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-user-cog-icon lucide-user-cog flex items-center"
                >
                  <path d="M10 15H6a4 4 0 0 0-4 4v2" />
                  <path d="m14.305 16.53.923-.382" />
                  <path d="m15.228 13.852-.923-.383" />
                  <path d="m16.852 12.228-.383-.923" />
                  <path d="m16.852 17.772-.383.924" />
                  <path d="m19.148 12.228.383-.923" />
                  <path d="m19.53 18.696-.382-.924" />
                  <path d="m20.772 13.852.924-.383" />
                  <path d="m20.772 16.148.924.383" />
                  <circle cx="18" cy="15" r="3" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                My Settings
              </SidebarTopLink>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>

        {/* Main Navigation */}
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.05}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-smart-home flex items-center align-middle justify-center translate-y-[-2px]"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" />
                  <path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" />
                </svg>
                Home
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/notifications">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-bell flex items-center align-middle justify-center"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                  <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                </svg>
                Notifications
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("live-activity") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("live-activity")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("live-activity") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
                    </svg>
                    Live Activity
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("live-activity") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("live-activity") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/inbox">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-message-dots"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 11v.01" />
                  <path d="M8 11v.01" />
                  <path d="M16 11v.01" />
                  <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0" />
                </svg>
                Message Box
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/calender">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-calendar-week"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" />
                  <path d="M16 3v4" />
                  <path d="M8 3v4" />
                  <path d="M4 11h16" />
                  <path d="M7 14h.013" />
                  <path d="M10.01 14h.005" />
                  <path d="M13.01 14h.005" />
                  <path d="M16.015 14h.005" />
                  <path d="M13.015 17h.005" />
                  <path d="M7.01 17h.005" />
                  <path d="M10.01 17h.005" />
                </svg>
                Calender
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("payments") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button onClick={() => toggle("payments")} className="w-full">
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-50 rounded-[20px]",
                      isOpen("payments") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icon-tabler-cash"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3" />
                      <path d="M7 10a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-8" />
                      <path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    </svg>
                    Payments
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("payments") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children */}
                {isOpen("payments") && (
                  <ul className="ml-4 mt-2 flex flex-col gap-2">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Events
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/fees">
                        School Fees
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/salaries">
                        Salaries
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>

        
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>

         {/* User Navigation */}
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("students") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("students")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("students") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-school"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" />
                    </svg>
                    Students
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("students") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("students") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("teachers") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("teachers")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("teachers") && "text-[#007146]",
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 318.97" className="w-5 h-5"><path fillRule="nonzero" d="M165.11 35.37c-3.87 0-6.99-3.12-6.99-6.99s3.12-6.99 6.99-6.99h148.37V6.99c0-3.87 3.12-6.99 6.99-6.99s6.99 3.12 6.99 6.99v14.4h176.8c3.87 0 6.99 3.12 6.99 6.99s-3.12 6.99-6.99 6.99h-16.09v200.88h16.84c3.87 0 6.99 3.12 6.99 6.99s-3.12 6.99-6.99 6.99H324.7v7.1c.38.25.63.5.87.75l42.8 40.68c2.74 2.62 2.87 7.11.25 9.85-2.62 2.75-7.11 2.87-9.86.25l-33.93-32.31v35.43c0 3.87-3.12 6.99-6.99 6.99s-6.99-3.12-6.99-6.99v-36.8l-35.43 33.68c-2.75 2.62-7.24 2.62-9.86-.25-2.62-2.74-2.62-7.23.25-9.85l42.8-40.68c.62-.62 1.49-1.12 2.24-1.5v-6.35H163.06c-3.87 0-6.99-3.12-6.99-6.99s3.12-6.99 6.99-6.99h311.13V35.37H165.11zM301.7 206.69a6.4 6.4 0 0 1-6.4-6.4c0-3.53 2.87-6.39 6.4-6.39h136.37c3.53 0 6.39 2.86 6.39 6.39 0 3.54-2.86 6.4-6.39 6.4H301.7zm9.66-42.99c-3.53 0-6.39-2.86-6.39-6.39 0-3.54 2.86-6.4 6.39-6.4h126.71c3.53 0 6.39 2.86 6.39 6.4 0 3.53-2.86 6.39-6.39 6.39H311.36zm-20.78-42.99c-3.53 0-6.39-2.86-6.39-6.39s2.86-6.4 6.39-6.4h147.49c3.53 0 6.39 2.87 6.39 6.4 0 3.53-2.86 6.39-6.39 6.39H290.58zm-65.77-42.99c-3.53 0-6.39-2.86-6.39-6.39s2.86-6.4 6.39-6.4h213.26c3.53 0 6.39 2.87 6.39 6.4 0 3.53-2.86 6.39-6.39 6.39H224.81zm-4.62 84.52 48.49-50.84c2.85-3 7.59-3.11 10.58-.27 3 2.85 3.11 7.59.27 10.58l-45.68 47.9c3.75 4.54 5.53 10.65 4.34 16.88-2.12 11.09-12.83 18.36-23.91 16.24l-50.71-9.75c-5.06-.88-9.8-3.66-13.05-8.15l-16.45-22.73-.04 2.05v-1.48l-1.31 75.84 1.99 11.36H49.66l1.76-10.52-1.56-75.24v.04l-.26-12.9-.09.1c-8.7 8.71-9.07 29.47-10.04 42.08l-2.21 28.88c-.51 6.59-1.06 10.31-6.22 14.77-7.5 6.46-20.13 7.79-26.8-.38-4.31-5.26-4.52-13.66-4.08-21.33 2.22-38.37 6.73-96.12 49.7-115.12v.48c18.22-7.24 39.69-4.09 59.29-4.09 9.33 0 17.53 1.37 24.81 4.16 4.65 1.07 8.94 3.76 11.96 7.93l32.96 45.57 41.31 7.94zM91.77 3.13c23.89 0 43.25 19.36 43.25 43.25 0 23.88-19.36 43.24-43.25 43.24S48.52 70.26 48.52 46.38c0-23.89 19.36-43.25 43.25-43.25z"/></svg>
                    Teachers
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("teachers") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("teachers") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("staff") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("staff")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("staff") && "text-[#007146]",
                    )}
                  >
                    <Image src="/icons/teamwork_3281785.svg" alt="staff" width={"24"} height={"24"}/>
                    Staff
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("staff") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("staff") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("admin-roles") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("admin-roles")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("admin-roles") && "text-[#007146]",
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-pen-icon lucide-user-round-pen"><path d="M2 21a8 8 0 0 1 10.821-7.487"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><circle cx="10" cy="8" r="5"/></svg>
                    Admin Role
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("admin-roles") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("admin-roles") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.05}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-smart-home flex items-center align-middle justify-center translate-y-[-2px]"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" />
                  <path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" />
                </svg>
                Home
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/students">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-bell flex items-center align-middle justify-center"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                  <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                </svg>
                Notifications
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("live-activity") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("live-activity")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("live-activity") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
                    </svg>
                    Live Activity
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("live-activity") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("live-activity") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/inbox">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-message-dots"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 11v.01" />
                  <path d="M8 11v.01" />
                  <path d="M16 11v.01" />
                  <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0" />
                </svg>
                Message Box
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/calender">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-calendar-week"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" />
                  <path d="M16 3v4" />
                  <path d="M8 3v4" />
                  <path d="M4 11h16" />
                  <path d="M7 14h.013" />
                  <path d="M10.01 14h.005" />
                  <path d="M13.01 14h.005" />
                  <path d="M16.015 14h.005" />
                  <path d="M13.015 17h.005" />
                  <path d="M7.01 17h.005" />
                  <path d="M10.01 17h.005" />
                </svg>
                Calender
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("payments") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button onClick={() => toggle("payments")} className="w-full">
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-50 rounded-[20px]",
                      isOpen("payments") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icon-tabler-cash"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3" />
                      <path d="M7 10a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-8" />
                      <path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    </svg>
                    Payments
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("payments") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children */}
                {isOpen("payments") && (
                  <ul className="ml-4 mt-2 flex flex-col gap-2">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Events
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/fees">
                        School Fees
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/salaries">
                        Salaries
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.05}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-smart-home flex items-center align-middle justify-center translate-y-[-2px]"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" />
                  <path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" />
                </svg>
                Home
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/students">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-bell flex items-center align-middle justify-center"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                  <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                </svg>
                Notifications
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("live-activity") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("live-activity")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("live-activity") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
                    </svg>
                    Live Activity
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("live-activity") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("live-activity") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/inbox">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-message-dots"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 11v.01" />
                  <path d="M8 11v.01" />
                  <path d="M16 11v.01" />
                  <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0" />
                </svg>
                Message Box
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/calender">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-calendar-week"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" />
                  <path d="M16 3v4" />
                  <path d="M8 3v4" />
                  <path d="M4 11h16" />
                  <path d="M7 14h.013" />
                  <path d="M10.01 14h.005" />
                  <path d="M13.01 14h.005" />
                  <path d="M16.015 14h.005" />
                  <path d="M13.015 17h.005" />
                  <path d="M7.01 17h.005" />
                  <path d="M10.01 17h.005" />
                </svg>
                Calender
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("payments") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button onClick={() => toggle("payments")} className="w-full">
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-50 rounded-[20px]",
                      isOpen("payments") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icon-tabler-cash"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3" />
                      <path d="M7 10a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-8" />
                      <path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    </svg>
                    Payments
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("payments") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children */}
                {isOpen("payments") && (
                  <ul className="ml-4 mt-2 flex flex-col gap-2">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Events
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/fees">
                        School Fees
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/salaries">
                        Salaries
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.05}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-smart-home flex items-center align-middle justify-center translate-y-[-2px]"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" />
                  <path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" />
                </svg>
                Home
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/students">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-bell flex items-center align-middle justify-center"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                  <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                </svg>
                Notifications
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("live-activity") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button
                  onClick={() => toggle("live-activity")}
                  className="w-full"
                >
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-100 rounded-[20px]",
                      isOpen("live-activity") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
                    </svg>
                    Live Activity
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("live-activity") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children (inside same background) */}
                {isOpen("live-activity") && (
                  <ul className="pl-8 pb-2 flex flex-col gap-1">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Real-time Attendance
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/transport">
                        Transport Status
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/inbox">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-message-dots"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 11v.01" />
                  <path d="M8 11v.01" />
                  <path d="M16 11v.01" />
                  <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3l12 0" />
                </svg>
                Message Box
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/calender">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="icon icon-tabler icons-tabler-outline icon-tabler-calendar-week"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" />
                  <path d="M16 3v4" />
                  <path d="M8 3v4" />
                  <path d="M4 11h16" />
                  <path d="M7 14h.013" />
                  <path d="M10.01 14h.005" />
                  <path d="M13.01 14h.005" />
                  <path d="M16.015 14h.005" />
                  <path d="M13.015 17h.005" />
                  <path d="M7.01 17h.005" />
                  <path d="M10.01 17h.005" />
                </svg>
                Calender
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <div
                className={clsx(
                  "rounded-[20px] transition-colors duration-200",
                  isOpen("payments") && "bg-gray-50",
                )}
              >
                {/* Parent */}
                <button onClick={() => toggle("payments")} className="w-full">
                  <span
                    className={clsx(
                      "flex items-center gap-2 w-full px-3 py-2 text-[14px]",
                      "hover:bg-gray-50 rounded-[20px]",
                      isOpen("payments") && "text-[#007146]",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="icon icon-tabler icon-tabler-cash"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path d="M7 15h-3a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v3" />
                      <path d="M7 10a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-8" />
                      <path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    </svg>
                    Payments
                    {/* Chevron */}
                    <svg
                      className={clsx(
                        "ml-auto h-4 w-4 transition-transform",
                        isOpen("payments") && "rotate-180",
                      )}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {/* Children */}
                {isOpen("payments") && (
                  <ul className="ml-4 mt-2 flex flex-col gap-2">
                    <li>
                      <SidebarLink href="/dashboard/attendance">
                        Events
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/fees">
                        School Fees
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/salaries">
                        Salaries
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>
          </ul>
        </nav>

        <footer className="sticky z-20 py-2  h-30 w-full bg-[#fffefb]">
          <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
          <div className="flex px-15 py-5 justify-between items-center align-middle gap-3 mt-0">
            <button
              className="w-full font-open  py-3 text-[14px] rounded-full bg-black text-white outline-2 focus:text-[#ffffff] focus:outline-1 focus:outline-[#d70000] focus:bg-[#f12424]
                hover:bg-transparent hover:text-black hover:scale-[1.01] cursor-pointer hover:outline-2 hover:outline-black hover:shadow-2xl transition-all duration-300"
            >
              Log out
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}
