"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import ProfileModal from "./Profile-Modal";
import { User } from 'lucide-react';

export default function Navbar() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);

  // Load saved theme
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

const [mobileMenu, setMobileMenu] = useState(false);


  return (
    <>
      <header className="fixed top-0 left-0 lg:left-64 right-0 bg-[#F6F6F6] pt-4 z-10 ">
        <div className="flex items-center h-16 px-6 mb-4">
          <button
  className="lg:hidden p-2 rounded-full bg-white shadow"
  onClick={() => setMobileMenu(!mobileMenu)}
>
  <svg width="24" height="24" fill="none" stroke="currentColor">
    <path strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
</button>
          <div className="mr-auto">
            <h2 className="font-open text-black text-[26px]">Hello Jeff!<span>👋</span></h2>
            <p className="text-gray-500 text-[15px]">23rd September 2026</p>
          </div>

          <div className="relative hidden md:block w-72 lg:w-96 rounded-[25px] overflow-hidden border border-white focus:outline-2 focus:outline-amber-300  bg-white">
            {/* Button */}
            <button
              className={`absolute left-[4px] top-1/2 -translate-y-1/2
      rounded-full w-11 h-11
      bg-gray-200 flex items-center justify-center
      cursor-pointer
      hover:bg-[#F7F9E2]
      hover:scale-[1.06]
      hover:text-gray-500
      transition-all duration-300
    `}
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

            {/* Input */}
            <input
              placeholder="Search anything..."
              className="w-full px-2 py-3 pl-14 rounded-[27px] outline-none font-open focus:outline-amber-300 focus:border-black focus:outline-2"
            />
          </div>

          <button
            className={`bg-white p-2 w-11 h-11 rounded-full flex items-center justify-center ml-2 cursor-pointer
      hover:bg-[#000000]
      hover:scale-[1.03]
      hover:text-gray-100
      transition-all duration-300`}
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

          <div className="ml-auto flex gap-4 items-center">
            <button
              onClick={toggleTheme}
              className={`{"w-full font-open  py-3 px-3 text-[14px] rounded-full bg-black text-white outline-2 active:text-[#ffffff] active:outline-1 active:outline-[#d7ac00] active:bg-[#d7ac00]
                hover:bg-[#d79300] hover:text-gray-50 hover:scale-[1.01] cursor-pointer hover:outline-1 hover:outline-[#d79300] hover:shadow-2xl transition-all duration-300"}`}
              aria-label="Toggle dark mode"
            >
              {dark ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width={24}
                  height={24}
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
                  width={24}
                  height={24}
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
              className={`bg-white p-2 w-11 h-11 rounded-full flex items-center justify-center ml-2 cursor-pointer
      hover:bg-[#000000]
      hover:scale-[1.06]
      hover:text-gray-100
      transition-all duration-300`}
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
            <div className="relative w-63 rounded-[25px] overflow-hidden border border-white focus:outline-2 focus:outline-amber-300  bg-white">
              {/* Button */}
              <button
                className={`absolute left-[4px] top-1/2 -translate-y-1/2
      rounded-full w-11 h-11
      bg-gray-200 flex items-center justify-center
      cursor-pointer
      hover:bg-[#F7F9E2]
      hover:scale-[1.06]
      hover:text-gray-500
      transition-all duration-300
    `}
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
              <div
                className={`absolute left-[2px] top-1/2 -translate-y-1/2 flex items-center justify-center
      cursor-pointer
      hover:scale-[1.03]
      hover:grayscale-70
      transition-all duration-300`}
              >
                <Image
                  src="/images/5739662.jpg"
                  alt="alt"
                  className="rounded-full w-12 h-12"
                  width={500}
                  height={500}
                />
              </div>
              {/* content */}
              <div className="w-fit px-2 py-2 pl-15 rounded-[27px] mr-auto">
                <h2 className="text-[15px] font-body font-[600]">
                  Jefferson Kimotho
                </h2>
                <p className="text-[12px]">Super Admin</p>
              </div>
              <button
                id="user-arrow"
                onClick={() => setOpen(true)}
                className="flex absolute ml-auto z-13 left-[13rem] top-1/2 -translate-y-1/2 rounded-full w-7 h-7 bg-gray-200 items-center justify-center hover:bg-black hover:text-white hover:scale-[1.04] cursor-pointer transition-all duration-300"
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
          </div>
        </div>
        <div className="border-b border-gray-400 w-[98%] ml-3"></div>
      </header>
      <div className="flex w-full relative">
      <ProfileModal open={open} onClose={() => setOpen(false)} />
        </div>
    </>
  );
}
