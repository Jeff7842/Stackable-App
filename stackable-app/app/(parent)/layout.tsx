"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import Sidebar, { type SidebarSection } from "@/components/sidebar/sidebar";
import Navbar from "@/components/header/dashboard-navbar";
import BreadCrumb from "@/components/breadcrumb/bread";
import {
  Bell,
  Home,
  MessagesSquare,
  UsersRound,
  UserCog,
  Wallet,
} from "lucide-react";

const DESKTOP_SIDEBAR_EXPANDED_OFFSET = "lg:pl-[17rem]";
const DESKTOP_SIDEBAR_COLLAPSED_OFFSET = "lg:pl-28";

const iconClassName = "h-5 w-5 shrink-0";
const iconStrokeWidth = 1.75;

const PARENT_SECTIONS: SidebarSection[] = [
  {
    key: "settings",
    ariaLabel: "Settings navigation",
    items: [
      {
        type: "link",
        href: "/family/settings",
        label: "My Settings",
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
        href: "/family",
        label: "Home",
        icon: <Home className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/family",
        label: "My Children",
        icon: (
          <UsersRound className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/family/fees",
        label: "School Fees",
        icon: <Wallet className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/family/notices",
        label: "Notices",
        icon: <Bell className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/family/inbox",
        label: "Inbox",
        icon: (
          <MessagesSquare className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
];

const ParentLayout = ({ children }: { children: React.ReactNode }) => {
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
        sections={PARENT_SECTIONS}
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

export default ParentLayout;
