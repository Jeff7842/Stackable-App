"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import Sidebar, { type SidebarSection } from "@/components/sidebar/sidebar";
import Navbar from "@/components/header/dashboard-navbar";
import BreadCrumb from "@/components/breadcrumb/bread";
import {
  Blocks,
  Building2,
  Home,
  ScrollText,
  UserCog,
  Users,
  Zap,
} from "lucide-react";

const DESKTOP_SIDEBAR_EXPANDED_OFFSET = "lg:pl-[17rem]";
const DESKTOP_SIDEBAR_COLLAPSED_OFFSET = "lg:pl-28";

const iconClassName = "h-5 w-5 shrink-0";
const iconStrokeWidth = 1.75;

const DEV_SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    key: "settings",
    ariaLabel: "Settings navigation",
    items: [
      {
        type: "link",
        href: "/dev/settings",
        label: "Platform Settings",
        variant: "top",
        icon: <UserCog className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
    ],
  },
  {
    key: "main",
    ariaLabel: "Main navigation",
    items: [
      {
        type: "link",
        href: "/dev",
        label: "Platform Overview",
        icon: <Home className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dev/schools",
        label: "Schools",
        icon: <Building2 className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dev/users",
        label: "Cross-School Users",
        icon: <Users className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dev/audit",
        label: "Audit Log",
        icon: <ScrollText className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dev/integrations",
        label: "Integrations",
        icon: <Blocks className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dev/feature-flags",
        label: "Feature Flags",
        icon: <Zap className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
    ],
  },
];

const DeveloperLayout = ({ children }: { children: React.ReactNode }) => {
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
        onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        sections={DEV_SIDEBAR_SECTIONS}
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

export default DeveloperLayout;
