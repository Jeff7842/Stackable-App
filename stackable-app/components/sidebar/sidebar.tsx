"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import clsx from "clsx";
import {
  Bell,
  Blocks,
  BookOpenText,
  BotMessageSquare,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  FileSpreadsheet,
  GraduationCap,
  Home,
  Layers3,
  LibraryBig,
  LogOut,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  ShieldUser,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  WandSparkles,
  Zap,
} from "lucide-react";

type SidebarChild = {
  href: string;
  label: string;
};

type SidebarLeafItem = {
  type: "link";
  href: string;
  icon: ReactNode;
  label: string;
  variant?: "default" | "top";
};

type SidebarGroupItem = {
  type: "group";
  children: SidebarChild[];
  icon: ReactNode;
  key: string;
  label: string;
};

type SidebarItem = SidebarLeafItem | SidebarGroupItem;

type SidebarSection = {
  ariaLabel: string;
  items: SidebarItem[];
  key: string;
};

type SidebarProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

const iconClassName = "h-5 w-5 shrink-0";
const iconStrokeWidth = 1.75;

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    key: "settings",
    ariaLabel: "Settings navigation",
    items: [
      {
        type: "link",
        href: "/dashboard/settings",
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
        href: "/dashboard",
        label: "Home",
        icon: <Home className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dashboard/notifications",
        label: "Notifications",
        icon: <Bell className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "group",
        key: "live-activity",
        label: "Live Activity",
        icon: <Zap className={iconClassName} strokeWidth={iconStrokeWidth} />,
        children: [
          { href: "/dashboard/attendance", label: "Real-time Attendance" },
          { href: "/dashboard/transport", label: "Transport Status" },
        ],
      },
      {
        type: "link",
        href: "/dashboard/inbox",
        label: "Message Box",
        icon: (
          <MessagesSquare className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/calender",
        label: "Calender",
        icon: (
          <CalendarDays className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "group",
        key: "payments",
        label: "Payments",
        icon: <Wallet className={iconClassName} strokeWidth={iconStrokeWidth} />,
        children: [
          { href: "/dashboard/attendance", label: "Events" },
          { href: "/dashboard/fees", label: "School Fees" },
          { href: "/dashboard/salaries", label: "Salaries" },
        ],
      },
    ],
  },
  {
    key: "people",
    ariaLabel: "People navigation",
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
          {
            href: "/dashboard/students/students-resources",
            label: "Student Resources",
          },
          { href: "/dashboard/students/allocation", label: "Allocation System" },
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
          { href: "/dashboard/teachers", label: "All teachers" },
          {
            href: "/dashboard/teachers/teachers-resources",
            label: "Teachers Resources",
          },
          {
            href: "/dashboard/teachers/load-allocation",
            label: "Teacher Load Allocation",
          },
        ],
      },
      {
        type: "group",
        key: "staff",
        label: "Staff",
        icon: (
          <BriefcaseBusiness
            className={iconClassName}
            strokeWidth={iconStrokeWidth}
          />
        ),
        children: [
          { href: "/dashboard/staff", label: "All Staff" },
          {
            href: "/dashboard/staff/staff-resources",
            label: "Staff Resources",
          },
        ],
      },
      {
        type: "group",
        key: "parents",
        label: "Parents/Gurdians",
        icon: <Users className={iconClassName} strokeWidth={iconStrokeWidth} />,
        children: [
          { href: "/dashboard/parents", label: "All Parents/Guardians" },
          {
            href: "/dashboard/parents/parents-resources",
            label: "Parents Resources",
          },
        ],
      },
      {
        type: "link",
        href: "/dashboard/schools",
        label: "Schools",
        icon: (
          <Building2 className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/admin-role",
        label: "Admin Role",
        icon: (
          <ShieldUser className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
  {
    key: "academics",
    ariaLabel: "Academic navigation",
    items: [
      {
        type: "link",
        href: "/dashboard/library",
        label: "Library",
        icon: (
          <LibraryBig className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
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
          <FileSpreadsheet
            className={iconClassName}
            strokeWidth={iconStrokeWidth}
          />
        ),
      },
    ],
  },
  {
    key: "coursework",
    ariaLabel: "Learning navigation",
    items: [
      {
        type: "link",
        href: "/dashboard/homework",
        label: "Homework",
        icon: (
          <NotebookPen className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/quizes",
        label: "Quizes",
        icon: (
          <ClipboardList className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/cognitive-abilities-test",
        label: "Cognitive Abilities Test",
        icon: (
          <BrainCircuit className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/exams",
        label: "Exams",
        icon: <ScrollText className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
    ],
  },
  {
    key: "ai",
    ariaLabel: "AI tools navigation",
    items: [
      {
        type: "link",
        href: "/dashboard/ai/summarizer",
        label: "AI Summaizer",
        icon: (
          <BotMessageSquare
            className={iconClassName}
            strokeWidth={iconStrokeWidth}
          />
        ),
      },
      {
        type: "link",
        href: "/dashboard/ai/quiz-generator",
        label: "AI Quiz Generator",
        icon: (
          <FileQuestion className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
      {
        type: "link",
        href: "/dashboard/ai/flashcard-maker",
        label: "AI FlashCard Maker",
        icon: <Layers3 className={iconClassName} strokeWidth={iconStrokeWidth} />,
      },
      {
        type: "link",
        href: "/dashboard/ai/homework-assistant",
        label: "AI HomeWork Assistant",
        icon: (
          <WandSparkles className={iconClassName} strokeWidth={iconStrokeWidth} />
        ),
      },
    ],
  },
];

function isPathActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroupKey(pathname: string) {
  for (const section of SIDEBAR_SECTIONS) {
    for (const item of section.items) {
      if (
        item.type === "group" &&
        item.children.some((child) => isPathActive(pathname, child.href))
      ) {
        return item.key;
      }
    }
  }

  return null;
}

function SectionDivider({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={clsx(
        "border-t border-gray-300",
        collapsed ? "mx-2" : "mx-[7px]",
      )}
    />
  );
}

type SidebarLinkButtonProps = {
  collapsed: boolean;
  item: SidebarLeafItem;
  onNavigate: () => void;
  pathname: string;
};

function SidebarLinkButton({
  collapsed,
  item,
  onNavigate,
  pathname,
}: SidebarLinkButtonProps) {
  const isActive = isPathActive(pathname, item.href);
  const activeClasses =
    item.variant === "top"
      ? "bg-[#e4f9e2] text-[#007146] font-medium"
      : "bg-[#F7F9E2] text-[#F19F24] font-medium";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "flex w-full items-center rounded-[20px] text-[14px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#F19F24]/30",
        collapsed ? "justify-center px-3 py-3" : "gap-3 px-3 py-2",
        "hover:bg-gray-100",
        isActive && activeClasses,
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {item.icon}
      </span>
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="truncate">{item.label}</span>
      )}
    </Link>
  );
}

type SidebarGroupButtonProps = {
  collapsed: boolean;
  isOpen: boolean;
  item: SidebarGroupItem;
  onNavigate: () => void;
  onOpenFromCollapsed: (key: string) => void;
  onToggle: (key: string) => void;
  pathname: string;
};

function SidebarGroupButton({
  collapsed,
  isOpen,
  item,
  onNavigate,
  onOpenFromCollapsed,
  onToggle,
  pathname,
}: SidebarGroupButtonProps) {
  const hasActiveChild = item.children.some((child) =>
    isPathActive(pathname, child.href),
  );

  return (
    <div
      className={clsx(
        "rounded-[20px] transition-colors duration-200",
        isOpen && "bg-gray-50",
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (collapsed) {
            onOpenFromCollapsed(item.key);
            return;
          }

          onToggle(item.key);
        }}
        aria-expanded={!collapsed && isOpen}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={clsx(
          "flex w-full items-center rounded-[20px] text-[14px] outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#F19F24]/30",
          collapsed ? "justify-center px-3 py-3" : "gap-3 px-3 py-2",
          "hover:bg-gray-100",
          (isOpen || hasActiveChild) && "text-[#007146]",
        )}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          {item.icon}
        </span>
        {collapsed ? (
          <span className="sr-only">{item.label}</span>
        ) : (
          <>
            <span className="truncate">{item.label}</span>
            <ChevronDown
              className={clsx(
                "ml-auto h-4 w-4 shrink-0 transition-transform",
                isOpen && "rotate-180",
              )}
              strokeWidth={2}
            />
          </>
        )}
      </button>

      {!collapsed && isOpen ? (
        <ul className="flex flex-col gap-1 pb-2 pl-8 pr-2">
          {item.children.map((child) => {
            const isActive = isPathActive(pathname, child.href);

            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex w-full items-center rounded-[18px] px-3 py-2 text-[13px] outline-none transition-colors duration-200 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#F19F24]/30",
                    isActive && "bg-[#F7F9E2] font-medium text-[#F19F24]",
                  )}
                >
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function Sidebar({
  isCollapsed,
  isMobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [openState, setOpenState] = useState<{
    key: string | null;
    pathname: string;
  }>({
    key: findActiveGroupKey(pathname),
    pathname,
  });
  const openKey =
    openState.pathname === pathname ? openState.key : findActiveGroupKey(pathname);

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar overlay"
        aria-hidden={!isMobileOpen}
        onClick={onCloseMobile}
        tabIndex={isMobileOpen ? 0 : -1}
        className={clsx(
          "fixed inset-0 z-30 bg-black/25 transition-opacity duration-300 lg:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="dashboard-sidebar"
        className={clsx(
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden rounded-r-[30px] border border-white bg-[#fffefb] shadow-[0_35px_35px_rgba(0,0,0,0.15)] outline-6 outline-gray-100 transition-[transform,width] duration-300 ease-out lg:left-[5px] lg:top-[5px] lg:z-20 lg:h-[calc(100vh-10px)] lg:rounded-[30px]",
          "w-[17rem] lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed && "lg:w-24",
        )}
      >
        <div className="sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <div className="sidebar-scroll-inner min-h-full">
            <div className="sticky top-0 z-20 bg-[#fffefb] px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center justify-center">
                  <Image
                    src="/logos/Symbol Light.webp"
                    alt="school-logo"
                    className="w-[45px]"
                    width={500}
                    height={500}
                  />
                </div>

                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-[#f9f7f7] text-black shadow-lg transition-[transform,colors] duration-300 hover:-translate-y-[2px] hover:scale-[1.05] hover:border-black hover:bg-black hover:text-white lg:flex"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5" strokeWidth={1.95} />
                  ) : (
                    <ChevronLeft className="h-5 w-5" strokeWidth={1.95} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-[#f9f7f7] text-black shadow-lg transition-[transform,colors] duration-300 hover:-translate-y-[2px] hover:scale-[1.05] hover:border-black hover:bg-black hover:text-white lg:hidden"
                  aria-label="Close sidebar"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={1.95} />
                </button>
              </div>

              <div className="mt-3">
                <SectionDivider collapsed={isCollapsed} />
              </div>
            </div>

            <div className="space-y-3 px-4 pb-4 pt-4">
              {SIDEBAR_SECTIONS.map((section, sectionIndex) => (
                <div key={section.key} className="space-y-3">
                  <nav aria-label={section.ariaLabel}>
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <li key={item.type === "group" ? item.key : item.href}>
                          {item.type === "link" ? (
                            <SidebarLinkButton
                              collapsed={isCollapsed}
                              item={item}
                              onNavigate={onCloseMobile}
                              pathname={pathname}
                            />
                          ) : (
                            <SidebarGroupButton
                              collapsed={isCollapsed}
                              isOpen={openKey === item.key}
                              item={item}
                              onNavigate={onCloseMobile}
                              onOpenFromCollapsed={(key) => {
                                setOpenState({ key, pathname });
                                onToggleCollapse();
                              }}
                              onToggle={(key) =>
                                setOpenState((current) => ({
                                  key:
                                    current.pathname === pathname &&
                                    current.key === key
                                      ? null
                                      : key,
                                  pathname,
                                }))
                              }
                              pathname={pathname}
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>

                  {sectionIndex < SIDEBAR_SECTIONS.length - 1 ? (
                    <SectionDivider collapsed={isCollapsed} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="sticky bottom-0 z-20 bg-[#fffefb] px-4 pb-4 pt-3">
          <SectionDivider collapsed={isCollapsed} />
          <div className="pt-4">
            <button
              type="button"
              aria-label={isCollapsed ? "Log out" : undefined}
              title={isCollapsed ? "Log out" : undefined}
              className={clsx(
                "flex w-full items-center rounded-full bg-black text-[14px] text-white outline-none transition-all duration-300 focus:bg-[#f12424] focus:text-[#ffffff] focus:outline-1 focus:outline-[#d70000] hover:scale-[1.01] hover:bg-transparent hover:text-black hover:shadow-2xl hover:outline-2 hover:outline-black",
                isCollapsed ? "justify-center px-3 py-3" : "justify-center gap-2 py-3",
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.9} />
              {isCollapsed ? (
                <span className="sr-only">Log out</span>
              ) : (
                <span>Log out</span>
              )}
            </button>
          </div>
        </footer>

        <style jsx>{`
          .sidebar-scroll {
            direction: rtl;
            scrollbar-width: none;
            scrollbar-color: transparent transparent;
          }

          .sidebar-scroll:hover {
            scrollbar-width: thin;
            scrollbar-color: #f19f24 #d1d5db;
          }

          .sidebar-scroll-inner {
            direction: ltr;
          }

          .sidebar-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
            background: transparent;
          }

          .sidebar-scroll:hover::-webkit-scrollbar {
            width: 1px;
          }

          .sidebar-scroll::-webkit-scrollbar-track,
          .sidebar-scroll::-webkit-scrollbar-thumb {
            background: transparent;
          }

          .sidebar-scroll:hover::-webkit-scrollbar-track {
            background: #d1d5db;
          }

          .sidebar-scroll:hover::-webkit-scrollbar-thumb {
            background: #f19f24;
            border-radius: 9999px;
          }
        `}</style>
      </aside>
    </>
  );
}
