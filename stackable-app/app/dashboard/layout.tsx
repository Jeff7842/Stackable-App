"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import Sidebar from "@/components/sidebar/sidebar";
import Navbar from "@/components/header/dashboard-navbar";
import BreadCrumb from "@/components/breadcrumb/bread";

const DESKTOP_SIDEBAR_EXPANDED_OFFSET = "lg:pl-[17rem]";
const DESKTOP_SIDEBAR_COLLAPSED_OFFSET = "lg:pl-28";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = originalOverflow;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="min-h-screen w-full bg-[#F6F6F6] text-black">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onToggleCollapse={() =>
          setIsSidebarCollapsed((current) => !current)
        }
      />

      <div
        className={clsx(
          "min-h-screen overflow-x-hidden transition-[padding] duration-300",
          isSidebarCollapsed
            ? DESKTOP_SIDEBAR_COLLAPSED_OFFSET
            : DESKTOP_SIDEBAR_EXPANDED_OFFSET,
        )}
      >
        <Navbar
          isMobileSidebarOpen={isMobileSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleMobileSidebar={() =>
            setIsMobileSidebarOpen((current) => !current)
          }
        />

        <main className="px-4 pb-10 pt-52 sm:px-5 sm:pt-48 xl:px-6 xl:pt-32">
          <div className="mb-4">
            <BreadCrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
