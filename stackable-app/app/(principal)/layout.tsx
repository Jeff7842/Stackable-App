"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import Sidebar, { type SidebarSection } from "@/components/sidebar/sidebar";
import Navbar from "@/components/header/dashboard-navbar";
import BreadCrumb from "@/components/breadcrumb/bread";
import {
  Bell,
  Blocks,
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  FileSpreadsheet,
  GraduationCap,
  Home,
  LibraryBig,
  MessagesSquare,
  ShieldUser,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Zap,
} from "lucide-react";

const DESKTOP_SIDEBAR_EXPANDED_OFFSET = "lg:pl-[17rem]";
const DESKTOP_SIDEBAR_COLLAPSED_OFFSET = "lg:pl-28";

const iconClassName = "h-5 w-5 shrink-0";
const iconStrokeWidth = 1.75;

const PRINCIPAL_SECTIONS: SidebarSection[] = [
  {
    key: "settings",
    ariaLabel: "Settings navigation",
    items: [
      {
        type: "link",
        href: "/admin/settings",
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
        href: "/admin",
        label: "Overview",
        icon: <Home className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/admin/notifications",
        label: "Notifications",
        icon: <Bell className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/admin/inbox",
        label: "Inbox",
        icon: (
          <MessagesSquare className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/admin/calendar",
        label: "Calendar",
        icon: (
          <CalendarDays className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
  {
    key: "people",
    ariaLabel: "People",
    items: [
      {
        type: "group",
        key: "students",
        label: "Students",
        icon: (
          <GraduationCap className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
        children: [
          { href: "/dashboard/students", label: "All Students" },
          { href: "/dashboard/students/allocation", label: "Allocation" },
        ],
      },
      {
        type: "group",
        key: "teachers",
        label: "Teachers",
        icon: (
          <UsersRound className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
        children: [
          { href: "/dashboard/teachers", label: "All Teachers" },
        ],
      },
      {
        type: "group",
        key: "staff",
        label: "Staff",
        icon: (
          <BriefcaseBusiness className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
        children: [
          { href: "/dashboard/staff", label: "All Staff" },
        ],
      },
      {
        type: "group",
        key: "parents",
        label: "Parents/Guardians",
        icon: <Users className={iconClassName} strokeWidth={iconStrokeWidth} />,
        children: [
          { href: "/dashboard/parents", label: "All Parents" },
        ],
      },
      {
        type: "link",
        href: "/dashboard/admin-role",
        label: "Admin Roles",
        icon: (
          <ShieldUser className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
  {
    key: "academics",
    ariaLabel: "Academics",
    items: [
      {
        type: "link",
        href: "/dashboard/classes",
        label: "Classes",
        icon: <Blocks className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dashboard/subjects",
        label: "Subjects",
        icon: (
          <BookOpenText className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/grades-reports",
        label: "Grades & Reports",
        icon: (
          <FileSpreadsheet className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/library",
        label: "Library",
        icon: (
          <LibraryBig className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
  {
    key: "finance",
    ariaLabel: "Finance",
    items: [
      {
        type: "group",
        key: "payments",
        label: "Payments",
        icon: <Wallet className={iconClassName} strokeWidth={iconStrokeWidth} />,
        children: [
          { href: "/dashboard/fees", label: "School Fees" },
          { href: "/dashboard/salaries", label: "Salaries" },
          { href: "/dashboard/attendance", label: "Events" },
        ],
      },
    ],
  },
];

const PrincipalLayout = ({ children }: { children: React.ReactNode }) => {
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
        sections={PRINCIPAL_SECTIONS}
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

export default PrincipalLayout;
