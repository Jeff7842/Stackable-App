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
    <aside className="w-64 md:none h-[98.4%] z-15 translate-y-[5px] translate-x-[5px] bg-[#fffefb] outline-6 outline-gray-100 shadow-[0_35px_35px_rgba(0,0,0,0.15)] inset-shadow-sm inset-shadow-gray-200 border border-white rounded-[30px] fixed left-0 top-0 overflow-hidden">
      <div
        className={`h-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-0.75 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-300
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb]:bg-[#F19F24]
    dark:[&::-webkit-scrollbar-track]:bg-neutral-400
    dark:[&::-webkit-scrollbar-thumb]:bg-[#007146]`}
      >
        <div className="fixed z-10 w-full bg-white ">
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
                      <SidebarLink href="/dashboard/students">
                        All Students
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/students/students-resources">
                        Student Resources
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/students/allocation">
                        Allocation System
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
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 48 48"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3}><path d="M25 29.999c7.99-.017 13.372-.233 16.512-.414c2.076-.12 3.752-1.591 3.992-3.656C45.757 23.76 46 20.5 46 16s-.243-7.76-.496-9.93c-.24-2.064-1.916-3.535-3.991-3.655C38.243 2.226 32.543 2 24 2q-1.028 0-2 .004M12.5 34v11M6 9.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 0 0-13 0"></path><path d="M28.539 16.338c.625.036 1.192.379 1.326.99c.144.656.226 1.675-.035 3.103c-.143.781-.809 1.342-1.596 1.45L20 23l-1.8 19.32c-.12 1.284-1.05 2.343-2.33 2.49a29 29 0 0 1-3.303.19c-1.263 0-2.403-.084-3.318-.185c-1.338-.149-2.3-1.275-2.373-2.62l-.618-11.317a67 67 0 0 1-2.578-.183a1.82 1.82 0 0 1-1.654-1.889c.117-3.77.593-7.216.989-9.515c.298-1.728 1.762-2.977 3.514-3.062c6.958-.338 14.84-.302 22.01.11Z"></path></g></svg>
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
                      <SidebarLink href="/dashboard/teachers">
                        All teachers
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/teachers/teachers-resources">
                        Teachers Resources
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/teachers/load-allocation">
                        Teacher Load Allocation
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
                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 36 36"><path fill="currentColor" d="M18.42 16.31a5.7 5.7 0 1 1 5.76-5.7a5.74 5.74 0 0 1-5.76 5.7m0-9.4a3.7 3.7 0 1 0 3.76 3.7a3.74 3.74 0 0 0-3.76-3.7"></path><path fill="currentColor" d="M18.42 16.31a5.7 5.7 0 1 1 5.76-5.7a5.74 5.74 0 0 1-5.76 5.7m0-9.4a3.7 3.7 0 1 0 3.76 3.7a3.74 3.74 0 0 0-3.76-3.7m3.49 10.74a20.6 20.6 0 0 0-13 2a1.77 1.77 0 0 0-.91 1.6v3.56a1 1 0 0 0 2 0v-3.43a18.92 18.92 0 0 1 12-1.68Z"></path><path fill="currentColor" d="M33 22h-6.7v-1.48a1 1 0 0 0-2 0V22H17a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V23a1 1 0 0 0-1-1m-1 10H18v-8h6.3v.41a1 1 0 0 0 2 0V24H32Z"></path><path fill="currentColor" d="M21.81 27.42h5.96v1.4h-5.96zM10.84 12.24a18 18 0 0 0-7.95 2A1.67 1.67 0 0 0 2 15.71v3.1a1 1 0 0 0 2 0v-2.9a16 16 0 0 1 7.58-1.67a7.3 7.3 0 0 1-.74-2m22.27 1.99a17.8 17.8 0 0 0-7.12-2a7.5 7.5 0 0 1-.73 2A15.9 15.9 0 0 1 32 15.91v2.9a1 1 0 1 0 2 0v-3.1a1.67 1.67 0 0 0-.89-1.48m-22.45-3.62v-.67a3.07 3.07 0 0 1 .54-6.11a3.15 3.15 0 0 1 2.2.89a8.2 8.2 0 0 1 1.7-1.08a5.13 5.13 0 0 0-9 3.27a5.1 5.1 0 0 0 4.7 5a7.4 7.4 0 0 1-.14-1.3m14.11-8.78a5.17 5.17 0 0 0-3.69 1.55a8 8 0 0 1 1.9 1a3.14 3.14 0 0 1 4.93 2.52a3.09 3.09 0 0 1-1.79 2.77a7 7 0 0 1 .06.93a8 8 0 0 1-.1 1.2a5.1 5.1 0 0 0 3.83-4.9a5.12 5.12 0 0 0-5.14-5.07"></path></svg>
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
                      <SidebarLink href="/dashboard/staff">
                        All Staff
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/staff/staff-resources">
                        Staff Resources
                      </SidebarLink>
                    </li>
                    <li>
                      <SidebarLink href="/dashboard/staff/duty-allocation">
                        Duty Allocation
                      </SidebarLink>
                    </li>
                  </ul>
                )}
              </div>
            </li>

            

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/admin-role">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-round-pen-icon lucide-user-round-pen"><path d="M2 21a8 8 0 0 1 10.821-7.487"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><circle cx="10" cy="8" r="5"/></svg>

                Admin Role
              </SidebarLink>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard/library">
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 20 20"><path fill="currentColor" d="M2 3.498C2 2.67 2.671 2 3.5 2h1c.827 0 1.499.67 1.499 1.498V16.48c0 .827-.672 1.497-1.5 1.497h-1c-.828 0-1.499-.67-1.499-1.497zm1.5-.5a.5.5 0 0 0-.5.5V16.48a.5.5 0 0 0 .5.499h1a.5.5 0 0 0 .499-.5V3.499a.5.5 0 0 0-.5-.5zm3.498.5C6.998 2.67 7.67 2 8.498 2h1c.828 0 1.499.67 1.499 1.498V16.48c0 .827-.671 1.497-1.5 1.497h-1c-.827 0-1.499-.67-1.499-1.497zm1.5-.5a.5.5 0 0 0-.5.5V16.48a.5.5 0 0 0 .5.499h1a.5.5 0 0 0 .5-.5V3.499a.5.5 0 0 0-.5-.5zm7.22 3.159a1.5 1.5 0 0 0-1.87-1.106l-.745.21a1.5 1.5 0 0 0-1.06 1.741l2.003 9.8a1.5 1.5 0 0 0 1.839 1.151l.985-.25c.79-.2 1.274-.994 1.092-1.787zm-1.598-.145a.5.5 0 0 1 .624.368l2.243 9.76a.5.5 0 0 1-.364.595l-.985.25a.5.5 0 0 1-.613-.383l-2.003-9.8a.5.5 0 0 1 .353-.58z"></path></svg>
                Library
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/classes">
              <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" fillRule="evenodd"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path><path fill="currentColor" d="M3 7a4 4 0 1 1 8 0a4 4 0 0 1-8 0m4-2a2 2 0 1 0 0 4a2 2 0 0 0 0-4M3 17a4 4 0 1 1 8 0a4 4 0 0 1-8 0m4-2a2 2 0 1 0 0 4a2 2 0 0 0 0-4M17 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8m-2 4a2 2 0 1 1 4 0a2 2 0 0 1-4 0m-2 10a1 1 0 0 1 1-1h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 0 1-1-1"></path></g></svg>
                Classes
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/subjects">
<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M19.562 7a2.132 2.132 0 0 0-2.1-2.5H6.538a2.132 2.132 0 0 0-2.1 2.5M17.5 4.5c.028-.26.043-.389.043-.496a2 2 0 0 0-1.787-1.993C15.65 2 15.52 2 15.26 2H8.74c-.26 0-.391 0-.497.011a2 2 0 0 0-1.787 1.993c0 .107.014.237.043.496" opacity={0.5}></path><path strokeLinecap="round" d="M15 18H9"></path><path d="M2.384 13.793c-.447-3.164-.67-4.745.278-5.77C3.61 7 5.298 7 8.672 7h6.656c3.374 0 5.062 0 6.01 1.024s.724 2.605.278 5.769l-.422 3c-.35 2.48-.525 3.721-1.422 4.464s-2.22.743-4.867.743h-5.81c-2.646 0-3.97 0-4.867-.743s-1.072-1.983-1.422-4.464z"></path></g></svg>                
Subjects
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/grades-reports">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 48 48"><g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth={2.8}><path d="M5 7a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v37H8a3 3 0 0 1-3-3zm30 17a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v17a3 3 0 0 1-3 3h-5z"></path><path strokeLinecap="round" d="M11 12h8m-8 7h12"></path></g></svg>
                Grades & Reports
              </SidebarLink>
            </li>
            
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/homework">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 32 32"><path fill="currentColor" d="M19 10h7v2h-7zm0 5h7v2h-7zm0 5h7v2h-7z" strokeWidth={0.1} stroke="currentColor"></path><path fill="currentColor" d="M28 5H4a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h24a2.003 2.003 0 0 0 2-2V7a2 2 0 0 0-2-2M4 7h11v18H4Zm13 18V7h11l.002 18Z" strokeWidth={0.1} stroke="currentColor"></path></svg>
                Homework
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/quizes">
<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth={1}><path strokeWidth={1.5} d="M12 2a7.5 7.5 0 0 0-4.8 13.263C8.19 16.089 9 17.21 9 18.5h6c0-1.29.81-2.411 1.8-3.238A7.5 7.5 0 0 0 12 2Z"></path><path strokeLinejoin="round" strokeWidth={1.5} d="M15 18.5H9v2a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5z"></path><path strokeLinecap="round" strokeWidth={1.5} d="M10 8c0-1.013.895-2 2-2s2 .82 2 1.833c0 .365-.116.705-.317.991C13.085 9.676 12 10.488 12 11.5"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.992 14h.009"></path></g></svg>                
              Quizes
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/cognitive-abilities-test">
<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 48 48"><g fill="currentColor" strokeWidth={0.1} stroke="currentColor"><path d="M20 15a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2h-8a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2zm-1 10a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2h-8a1 1 0 0 1-1-1m1 3a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2z"></path><path fillRule="evenodd" d="M10 27a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zm2 1v3h3v-3z" clipRule="evenodd"></path><path d="M17.707 15.707a1 1 0 0 0-1.414-1.414L13 17.586l-1.293-1.293a1 1 0 0 0-1.414 1.414L13 20.414z"></path><path fillRule="evenodd" d="M10 6a4 4 0 0 0-4 4v28a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V10a4 4 0 0 0-4-4zm-2 4a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v28a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2zm28 6a3 3 0 1 1 6 0v20.303l-3 4.5l-3-4.5zm3-1a1 1 0 0 0-1 1v2h2v-2a1 1 0 0 0-1-1m0 22.197l-1-1.5V20h2v15.697z" clipRule="evenodd"></path></g></svg>                
Cognitive Abilities Test
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/exams">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 256 256"><path fill="currentColor" d="M216 42H40a14 14 0 0 0-14 14v160a6 6 0 0 0 8.68 5.37L64 206.71l29.32 14.66a6 6 0 0 0 5.36 0L128 206.71l29.32 14.66a6 6 0 0 0 5.36 0L192 206.71l29.32 14.66a6 6 0 0 0 2.68.63a5.93 5.93 0 0 0 3.15-.9A6 6 0 0 0 230 216V56a14 14 0 0 0-14-14m2 164.29l-23.32-11.66a6 6 0 0 0-5.36 0L160 209.29l-29.32-14.66a6 6 0 0 0-5.36 0L96 209.29l-29.32-14.66a6 6 0 0 0-5.36 0L38 206.29V56a2 2 0 0 1 2-2h176a2 2 0 0 1 2 2Zm-116.63-113a6 6 0 0 0-10.74 0l-32 64a6 6 0 1 0 10.74 5.36L75.71 150h40.58l6.34 12.68a6 6 0 1 0 10.74-5.36ZM81.71 138L96 109.42L110.29 138ZM198 128a6 6 0 0 1-6 6h-18v18a6 6 0 0 1-12 0v-18h-18a6 6 0 0 1 0-12h18v-18a6 6 0 0 1 12 0v18h18a6 6 0 0 1 6 6" strokeWidth={3} stroke="currentColor"></path></svg>
                Exams
              </SidebarLink>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul className="space-y-5">
            <li className="mt-3 mb-3 ">
              <SidebarLink href="/dashboard/ai/summarizer">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 48 48"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M35.3 15.172H12.664c-.758 0-1.372.614-1.372 1.372V39.18c0 .758.614 1.372 1.371 1.372H35.3c.757 0 1.372-.614 1.372-1.372V16.544c0-.758-.615-1.372-1.372-1.372" strokeWidth={2}></path><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}><path d="m36.54 34.844l2.08.218a1.37 1.37 0 0 0 1.507-1.221l2.365-22.512a1.37 1.37 0 0 0-1.22-1.508L18.758 7.455a1.37 1.37 0 0 0-1.508 1.221l-.675 6.424"></path><path d="M17.084 10.39L6.728 11.48c-.753.08-1.3.754-1.22 1.508l2.369 22.511c.08.754.754 1.3 1.508 1.221l1.768-.186m5.381-15.293H31.43m-14.896 4.414H31.43M16.534 30.07H31.43m-14.896 4.414h6.896"></path></g></svg>
                AI Summaizer
              </SidebarLink>
            </li>
            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/ai/quiz-generator">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="M14.045 14.303q.236-.236.236-.545t-.236-.545t-.545-.236t-.545.236t-.236.545t.236.545t.545.236t.545-.236m-.545-2.58q.179 0 .31-.123t.163-.294q.05-.396.232-.665q.181-.27.703-.752q.634-.577.884-1.03t.25-1.04q0-1.01-.72-1.683q-.72-.674-1.822-.674q-.71 0-1.308.336q-.598.337-.96.96q-.091.153-.024.323t.232.236q.16.068.336.016t.274-.206q.263-.402.621-.603t.829-.201q.715 0 1.186.424q.472.424.472 1.095q0 .408-.23.759q-.228.351-.786.845q-.57.49-.79.876t-.27.959q-.024.165.102.304q.125.138.316.138M8.116 17q-.691 0-1.153-.462T6.5 15.385V4.615q0-.69.463-1.153T8.116 3h10.769q.69 0 1.153.462t.462 1.153v10.77q0 .69-.462 1.152T18.884 17zm0-1h10.769q.23 0 .423-.192t.192-.423V4.615q0-.23-.192-.423T18.884 4H8.116q-.231 0-.424.192t-.192.423v10.77q0 .23.192.423t.423.192m-3 4q-.69 0-1.153-.462T3.5 18.385V7.115q0-.213.143-.356T4 6.616t.357.143t.143.357v11.269q0 .23.192.423t.423.192h11.27q.213 0 .356.143t.144.357t-.144.357t-.356.143zM7.5 4v12z" strokeWidth={0.2} stroke="currentColor"></path></svg>
                AI Quiz Generator
              </SidebarLink>
            </li>

            <li className="mt-3 mb-3">
              <SidebarLink href="/dashboard/ai/flashcard-maker">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" fillRule="evenodd" d="m16.394 2.021l.066.018c1.1.295 1.971.528 2.656.776c.701.253 1.273.542 1.744.983a4.75 4.75 0 0 1 1.378 2.389c.147.628.112 1.268-.02 2.001c-.127.718-.36 1.589-.655 2.688l-.536 1.999c-.294 1.099-.528 1.97-.775 2.656c-.254.7-.543 1.272-.984 1.743a4.75 4.75 0 0 1-2.302 1.358a4.75 4.75 0 0 1-1.106 1.567c-.471.441-1.043.73-1.744.984c-.685.248-1.556.481-2.655.776l-.067.018c-1.1.294-1.97.527-2.688.656c-.733.131-1.373.166-2.002.02a4.75 4.75 0 0 1-2.388-1.38c-.44-.47-.73-1.042-.984-1.743c-.247-.685-.48-1.556-.775-2.656l-.536-1.998c-.294-1.1-.528-1.97-.656-2.688c-.131-.733-.166-1.373-.02-2.002a4.75 4.75 0 0 1 1.38-2.388c.47-.44 1.042-.73 1.743-.984c.685-.247 1.556-.48 2.655-.775l.034-.01l.751-.2c.392-1.399.736-2.388 1.408-3.105a4.75 4.75 0 0 1 2.388-1.379c.629-.146 1.268-.111 2.002.02c.717.128 1.588.362 2.688.656M7.455 7.503c-1.093.293-1.876.505-2.478.722c-.61.22-.967.424-1.227.668a3.25 3.25 0 0 0-.944 1.634c-.08.348-.079.76.036 1.397c.115.647.332 1.457.637 2.597l.518 1.932c.305 1.14.523 1.95.746 2.567c.22.61.424.968.668 1.228a3.25 3.25 0 0 0 1.634.944c.347.08.76.078 1.397-.036c.647-.115 1.457-.332 2.597-.637c1.14-.306 1.95-.523 2.568-.747c.609-.22.967-.424 1.227-.667q.207-.195.376-.419a10 10 0 0 1-.554-.095c-.672-.134-1.48-.35-2.475-.617l-.058-.015c-1.099-.295-1.97-.528-2.655-.776c-.701-.253-1.273-.542-1.744-.983a4.75 4.75 0 0 1-1.379-2.389c-.146-.628-.111-1.268.02-2.001c.128-.718.362-1.589.656-2.688zm5.987-4.661c-.638-.115-1.05-.117-1.397-.036a3.25 3.25 0 0 0-1.634.944c-.436.465-.705 1.185-1.171 2.893l-.243.902l-.518 1.932c-.305 1.14-.522 1.95-.637 2.597c-.115.637-.117 1.05-.036 1.397a3.25 3.25 0 0 0 .944 1.634c.26.244.618.447 1.227.668c.618.223 1.428.44 2.568.746c1.025.275 1.785.478 2.403.6c.615.123 1.033.153 1.375.111q.112-.015.216-.038a3.25 3.25 0 0 0 1.634-.944c.244-.26.448-.618.668-1.227c.223-.618.44-1.428.746-2.568l.518-1.932c.305-1.14.522-1.95.637-2.597c.114-.637.117-1.05.036-1.397a3.25 3.25 0 0 0-.944-1.634c-.26-.244-.618-.447-1.227-.668c-.619-.223-1.428-.44-2.568-.746c-1.14-.305-1.95-.522-2.597-.637" clipRule="evenodd" strokeWidth={0.1} stroke="currentColor"></path></svg>
                AI FlashCard Maker
              </SidebarLink>
            </li>
            <li className="mt-5 mb-3">
              <SidebarLink href="/dashboard/ai/homework-assistant">
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 16 16"><path fill="currentColor" d="M3.736 1.529h8.723a1.92 1.92 0 0 1 1.918 1.918v8.665a1.92 1.92 0 0 1-1.918 1.918H3.736a.386.386 0 0 1-.384-.383v-1.663h-.639a.384.384 0 1 1 0-.767h.64V8.164h-.64a.384.384 0 0 1 0-.767h.64V4.343h-.64a.384.384 0 0 1 0-.767h.64V1.913a.386.386 0 0 1 .383-.384m.384.767v1.28h.639a.384.384 0 1 1 0 .767h-.64v3.054h.64a.384.384 0 0 1 0 .767h-.64v3.054h.64a.384.384 0 0 1 0 .767h-.64v1.279h8.339a1.15 1.15 0 0 0 1.151-1.151V3.448a1.15 1.15 0 0 0-1.15-1.151z" strokeWidth={0.1} stroke="currentColor"></path><path fill="currentColor" d="M11.61 7.738a.386.386 0 0 1-.383.384H7.134a.384.384 0 0 1 0-.767h4.092a.386.386 0 0 1 .383.383M11.226 9.4H7.134a.384.384 0 0 0 0 .767h4.092a.384.384 0 1 0 0-.767m.385-3.693a.386.386 0 0 1-.384.384H7.136a.384.384 0 0 1 0-.767h4.091a.386.386 0 0 1 .384.383" strokeWidth={0} stroke="currentColor"></path></svg>
                AI HomeWork Assistant
              </SidebarLink>
            </li>
          </ul>
        </nav>

        <footer className="sticky z-20 py-2  h-30 w-full bg-[#fffefb]">
          <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
          <div className="flex px-15 py-5 justify-between items-center align-middle gap-3 mt-0">
            <button
              className={`w-full font-open  py-3 text-[14px] rounded-full bg-black text-white outline-2 focus:text-[#ffffff] focus:outline-1 focus:outline-[#d70000] focus:bg-[#f12424]
                hover:bg-transparent hover:text-black hover:scale-[1.01] cursor-pointer hover:outline-2 hover:outline-black hover:shadow-2xl transition-all duration-300`}
            >
              Log out

            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
}
