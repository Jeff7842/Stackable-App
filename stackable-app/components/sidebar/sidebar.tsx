"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const isOpen = (key: string) => openKey === key;

  return (
    <aside className="w-64 h-[98.4%] z-15 translate-y-[5px] translate-x-[5px] bg-[#fffefb] shadow-[0_35px_35px_rgba(0,0,0,0.15)] inset-shadow-sm inset-shadow-gray-200 border border-white rounded-[30px] fixed left-0 top-0 overflow-hidden">
      <div
        className="h-full overflow-y-auto overflow-x-hidden
    [&::-webkit-scrollbar]:w-1
    [&::-webkit-scrollbar-track]:rounded-full
    [&::-webkit-scrollbar-track]:bg-gray-100
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb]:bg-gray-300
    dark:[&::-webkit-scrollbar-track]:bg-neutral-700
    dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
      >
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
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li className="mt-3 mb-3">
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] text-center align-middle items-center justify-center"
              >
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
              </Link>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li className="mt-3 mb-3">
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
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
              </Link>
            </li>
            <li className="mt-3 mb-3">
              <Link
                href="/dashboard/students"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
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
              </Link>
            </li>
            <li className="mt-3 mb-3">
              {/* Parent */}
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 text-[14px] font-body w-full"
              >
                <span className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center">
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
                    className="icon icon-tabler icons-tabler-outline icon-tabler-bolt flex items-center align-middle justify-center"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" />
                  </svg>
                  Live Activity
                </span>

                {/* Chevron */}
                <svg
                  className={`ml-auto h-4 w-4 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Children */}
              {open && (
                <ul className="ml-4 mt-2 flex flex-col gap-2">
                  <li>
                    <Link
                      href="/dashboard/attendance"
                      className="text-[14px] text-gray-900 hover:text-black"
                    >
                      Real-time Attendance
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/transport"
                      className="text-[14px] text-gray-900 hover:text-black"
                    >
                      Transport Status
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li className="mt-3 mb-3">
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
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
              </Link>
            </li>
            <li className="mt-5 mb-3">
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
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
              </Link>
            </li>
            <li className="mt-3 mb-3">
              {/* Parent */}
              <button
                onClick={() => toggle("payments")}
                className="flex items-center gap-2 text-[14px] font-body w-full"
              >
                <span className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 items-center">
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
                </span>

                {/* Chevron */}
                <svg
                  className={`ml-auto h-4 w-4 transition-transform ${
                    isOpen("payments") ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Children */}
              {isOpen("payments") && (
                <ul className="ml-4 mt-2 flex flex-col gap-2">
                  <li>
                    <Link
                      href="/dashboard/attendance"
                      className="text-[14px] text-gray-900 indent-[10px]"
                    >
                      Events
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/fees"
                      className="text-[14px] text-gray-900"
                    >
                      School Fees
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/salaries"
                      className="text-[14px] text-gray-900"
                    >
                      Salaries
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/students"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Students
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/teachers"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Teachers
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Payments
              </Link>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/students"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Students
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/teachers"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Teachers
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Payments
              </Link>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/students"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Students
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/teachers"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Teachers
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Payments
              </Link>
            </li>
          </ul>
        </nav>
        <div className="grow border-t border-gray-300 mb-3.25 mt-3.75 w-[93%] flex ml-[7px]"></div>
        <nav className="flex flex-col gap-2 px-4">
          <ul>
            <li>
              <Link
                href="/dashboard"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/students"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Students
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/teachers"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Teachers
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/payments"
                className="flex w-fit gap-[5px] font-body font-300 text-[14px] mt-3 mb-3 text-center align-middle items-center justify-center"
              >
                Payments
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
