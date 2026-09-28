// =============================================================================
// Dashboard navigation - the ONE place every portal's menu is defined.
// -----------------------------------------------------------------------------
// Used by: the Sidebar, the mobile bottom pill, the top-bar title, the quick
// page-jump search and the notification bell. To add a page to a menu, add one
// `link(...)` (or a child inside a `group(...)`) below - nothing else to touch.
//
//   link(href, label, icon, extra?)
//        icon is a SOLAR icon base name, e.g. "home-2". The sidebar renders
//        `solar:home-2-linear`, and `solar:home-2-bold` for the active item.
//   group(key, label, icon, children, extra?)
//        an expandable parent. Children are plain { href, label } rows.
//   extra.primary   true = candidate for the mobile bottom pill (max 4 are used)
//   extra.keywords  extra words the quick search should match
//   child.title     page title when it differs from the row label
//                   (e.g. row "All students" -> page title "Students")
//
// Every href here must resolve to a real page.tsx (or a ComingSoon page).
// Portal "principal" (/admin) links into the SAME /dashboard/* pages as the
// school workspace, by design (see the plan, section 4.4).
// =============================================================================

import type { Portal } from "@/lib/validation/shared";
import type {
  SidebarChild,
  SidebarGroupItem,
  SidebarLeafItem,
  SidebarSection,
} from "@/components/sidebar/sidebar";

// -----------------------------------------------------------------------------
// Small builders (keep the config below readable)
// -----------------------------------------------------------------------------
type LeafExtra = Pick<SidebarLeafItem, "primary" | "keywords" | "title" | "live">;
type GroupExtra = Pick<SidebarGroupItem, "primary" | "keywords" | "live">;

function link(
  href: string,
  label: string,
  icon: string,
  extra: LeafExtra = {},
): SidebarLeafItem {
  return { type: "link", href, label, icon, ...extra };
}

function group(
  key: string,
  label: string,
  icon: string,
  children: SidebarChild[],
  extra: GroupExtra = {},
): SidebarGroupItem {
  return { type: "group", key, label, icon, children, ...extra };
}

function section(
  key: string,
  label: string,
  items: SidebarSection["items"],
): SidebarSection {
  return { key, label, ariaLabel: `${label} navigation`, items };
}

// -----------------------------------------------------------------------------
// Portal metadata
// -----------------------------------------------------------------------------
export const PORTAL_LABEL: Record<Portal, string> = {
  dashboard: "School workspace",
  principal: "Principal",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
  developer: "Developer",
};

/** Each portal's landing page. Index routes are matched EXACTLY (see activeNavHref). */
export const PORTAL_HOME: Record<Portal, string> = {
  dashboard: "/dashboard",
  principal: "/admin",
  teacher: "/teach",
  student: "/learn",
  parent: "/family",
  developer: "/dev",
};

// -----------------------------------------------------------------------------
// The menus
// -----------------------------------------------------------------------------
export const NAV: Record<Portal, SidebarSection[]> = {
  // ---------------------------------------------------------------------------
  // /dashboard/* - the school admin workspace
  // ---------------------------------------------------------------------------
  dashboard: [
    section("workspace", "Workspace", [
      link("/dashboard", "Overview", "home-2", { primary: true }),
      link("/dashboard/calender", "Calendar", "calendar", {
        keywords: ["calender", "events", "schedule", "timetable"],
      }),
      group("live-activity", "Live activity", "pulse", [
        { href: "/dashboard/live-activity", label: "Live overview", title: "Live activity" },
        { href: "/dashboard/live-activity/real-time", label: "Real-time" },
        { href: "/dashboard/live-activity/transport-status", label: "Transport status" },
      ], { live: true, keywords: ["attendance", "bus", "transport"] }),
    ]),
    section("people", "People", [
      link("/dashboard/admin-role", "Users & permissions", "shield-user", {
        keywords: ["roles", "admins", "access", "accounts"],
      }),
      link("/dashboard/schools", "Schools", "buildings-2"),
      group("students", "Students", "square-academic-cap", [
        { href: "/dashboard/students", label: "All students", title: "Students" },
        { href: "/dashboard/students/allocation", label: "Allocation" },
        { href: "/dashboard/students/students-resources", label: "Resources", title: "Student resources" },
      ], { primary: true, keywords: ["pupils", "learners"] }),
      group("teachers", "Teachers", "users-group-two-rounded", [
        { href: "/dashboard/teachers", label: "All teachers", title: "Teachers" },
        { href: "/dashboard/teachers/load-allocation", label: "Load allocation" },
        { href: "/dashboard/teachers/teachers-resources", label: "Resources", title: "Teacher resources" },
      ]),
      group("parents", "Parents & guardians", "user-hands", [
        { href: "/dashboard/parents", label: "All parents", title: "Parents & guardians" },
        { href: "/dashboard/parents/parents-resources", label: "Resources", title: "Parent resources" },
      ], { keywords: ["family"] }),
      group("staff", "Staff", "case-round", [
        { href: "/dashboard/staff", label: "All staff", title: "Staff" },
        { href: "/dashboard/staff/duty-allocation", label: "Duty allocation" },
        { href: "/dashboard/staff/staff-resources", label: "Resources", title: "Staff resources" },
      ]),
    ]),
    section("academics", "Academics", [
      link("/dashboard/classes", "Classes", "widget-2", { keywords: ["streams", "grades"] }),
      link("/dashboard/subjects", "Subjects", "book-2", { keywords: ["curriculum"] }),
      link("/dashboard/homework", "Homework", "notebook", { keywords: ["assignments"] }),
      link("/dashboard/exams", "Exams", "document-text", { keywords: ["tests", "assessments"] }),
      link("/dashboard/quizes", "Quizzes", "checklist-minimalistic", { keywords: ["quizes"] }),
      link("/dashboard/cognitive-abilities-test", "Cognitive abilities test", "brain", { keywords: ["cat"] }),
      link("/dashboard/grades-reports", "Grades & reports", "chart-square", { keywords: ["results", "report cards"] }),
      link("/dashboard/library", "Library", "library", { keywords: ["books", "resources"] }),
    ]),
    section("finance", "Finance", [
      group("payments", "Payments", "wallet-money", [
        { href: "/dashboard/payments", label: "Overview", title: "Payments" },
        { href: "/dashboard/payments/school-fees", label: "School fees" },
        { href: "/dashboard/payments/salaries", label: "Salaries" },
        { href: "/dashboard/payments/events", label: "Events" },
        { href: "/dashboard/payments/events/maintenance", label: "Event maintenance" },
      ], { primary: true, keywords: ["money", "fees", "finance", "invoices"] }),
    ]),
    section("communication", "Communication", [
      link("/dashboard/inbox", "Inbox", "inbox", { primary: true, keywords: ["mail", "messages"] }),
      link("/dashboard/message-app", "Messages", "chat-round-dots", { keywords: ["chat"] }),
      link("/dashboard/notifications", "Notifications", "bell", { keywords: ["alerts"] }),
    ]),
    section("insights", "Insights", [
      link("/dashboard/analytics", "Analytics", "chart-2", { keywords: ["reports", "statistics"] }),
      group("ai", "AI tools", "magic-stick-3", [
        { href: "/dashboard/ai/summarizer", label: "Summarizer", title: "AI summarizer" },
        { href: "/dashboard/ai/quiz-generator", label: "Quiz generator", title: "AI quiz generator" },
        { href: "/dashboard/ai/flashcard-maker", label: "Flashcard maker", title: "AI flashcard maker" },
        { href: "/dashboard/ai/homework-assistant", label: "Homework assistant", title: "AI homework assistant" },
      ], { keywords: ["ai", "assistant"] }),
    ]),
    section("system", "System", [link("/dashboard/settings", "Settings", "settings")]),
  ],

  // ---------------------------------------------------------------------------
  // /admin - principal / manager. Overview lives here; everything else is a
  // link into the shared /dashboard/* pages.
  // ---------------------------------------------------------------------------
  principal: [
    section("workspace", "Workspace", [
      link("/admin", "Overview", "home-2", { primary: true }),
      link("/dashboard/calender", "Calendar", "calendar", { keywords: ["calender", "events", "schedule"] }),
    ]),
    section("people", "People", [
      link("/dashboard/admin-role", "Users & permissions", "shield-user", { keywords: ["roles", "access"] }),
      group("students", "Students", "square-academic-cap", [
        { href: "/dashboard/students", label: "All students", title: "Students" },
        { href: "/dashboard/students/allocation", label: "Allocation" },
      ], { primary: true }),
      group("teachers", "Teachers", "users-group-two-rounded", [
        { href: "/dashboard/teachers", label: "All teachers", title: "Teachers" },
        { href: "/dashboard/teachers/load-allocation", label: "Load allocation" },
      ]),
      link("/dashboard/parents", "Parents & guardians", "user-hands", { keywords: ["family"] }),
      group("staff", "Staff", "case-round", [
        { href: "/dashboard/staff", label: "All staff", title: "Staff" },
        { href: "/dashboard/staff/duty-allocation", label: "Duty allocation" },
      ]),
    ]),
    section("academics", "Academics", [
      link("/dashboard/classes", "Classes", "widget-2"),
      link("/dashboard/subjects", "Subjects", "book-2"),
      link("/dashboard/exams", "Exams", "document-text"),
      link("/dashboard/grades-reports", "Grades & reports", "chart-square", { keywords: ["results"] }),
      link("/dashboard/library", "Library", "library"),
    ]),
    section("finance", "Finance", [
      group("payments", "Payments", "wallet-money", [
        { href: "/dashboard/payments", label: "Overview", title: "Payments" },
        { href: "/dashboard/payments/school-fees", label: "School fees" },
        { href: "/dashboard/payments/salaries", label: "Salaries" },
        { href: "/dashboard/payments/events", label: "Events" },
      ], { primary: true, keywords: ["money", "fees", "finance"] }),
    ]),
    section("communication", "Communication", [
      link("/dashboard/inbox", "Inbox", "inbox", { primary: true, keywords: ["mail", "messages"] }),
      link("/dashboard/notifications", "Notifications", "bell"),
    ]),
    section("insights", "Insights", [link("/dashboard/analytics", "Analytics", "chart-2")]),
    section("system", "System", [link("/dashboard/settings", "Settings", "settings")]),
  ],

  // ---------------------------------------------------------------------------
  // /teach
  // ---------------------------------------------------------------------------
  teacher: [
    section("workspace", "Workspace", [link("/teach", "Home", "home-2", { primary: true })]),
    section("teaching", "Teaching", [
      link("/teach/classes", "My classes", "widget-2", { primary: true }),
      link("/teach/students", "My students", "square-academic-cap"),
      link("/teach/subjects", "My subjects", "book-2"),
      link("/teach/timetable", "Timetable", "clock-circle", { keywords: ["schedule", "lessons"] }),
    ]),
    section("daily", "Daily work", [
      link("/teach/attendance", "Attendance", "clipboard-check", { primary: true, keywords: ["register", "roll call"] }),
      link("/teach/grading", "Grading", "pen-new-square", { keywords: ["marks", "assessment"] }),
    ]),
    section("communication", "Communication", [
      link("/teach/inbox", "Inbox", "inbox", { primary: true, keywords: ["mail", "messages"] }),
    ]),
    section("system", "System", [link("/teach/settings", "Settings", "settings")]),
  ],

  // ---------------------------------------------------------------------------
  // /learn
  // ---------------------------------------------------------------------------
  student: [
    section("workspace", "Workspace", [link("/learn", "Home", "home-2", { primary: true })]),
    section("learning", "Learning", [
      link("/learn/subjects", "My subjects", "book-2", { primary: true }),
      link("/learn/homework", "Homework", "notebook", { primary: true, keywords: ["assignments"] }),
      link("/learn/grades", "My grades", "chart-square", { primary: true, keywords: ["results", "marks"] }),
      link("/learn/library", "Library", "library", { keywords: ["books"] }),
    ]),
    section("communication", "Communication", [
      link("/learn/inbox", "Inbox", "inbox", { keywords: ["mail", "messages"] }),
    ]),
    section("system", "System", [link("/learn/settings", "Settings", "settings")]),
  ],

  // ---------------------------------------------------------------------------
  // /family
  // ---------------------------------------------------------------------------
  parent: [
    section("workspace", "Workspace", [link("/family", "Home", "home-2", { primary: true })]),
    section("family", "Family", [
      link("/family/children", "My children", "users-group-rounded", { primary: true, keywords: ["students", "kids"] }),
      link("/family/fees", "School fees", "wallet-money", { primary: true, keywords: ["payments", "balance"] }),
      link("/family/notices", "Notices", "bell-bing", { primary: true, keywords: ["announcements"] }),
    ]),
    section("communication", "Communication", [
      link("/family/inbox", "Inbox", "inbox", { keywords: ["mail", "messages"] }),
    ]),
    section("system", "System", [link("/family/settings", "Settings", "settings")]),
  ],

  // ---------------------------------------------------------------------------
  // /dev - platform console (super-admin)
  // ---------------------------------------------------------------------------
  developer: [
    section("platform", "Platform", [
      link("/dev", "Overview", "home-2", { primary: true }),
      link("/dev/sitemap", "Sitemap", "widget-5", {
        keywords: ["pages", "routes", "every page", "all pages", "portals"],
      }),
      link("/dev/schools", "Schools", "buildings-2", { primary: true }),
      link("/dev/users", "Users", "users-group-two-rounded", { primary: true, keywords: ["impersonate", "accounts"] }),
    ]),
    section("trust", "Trust & safety", [
      link("/dev/audit", "Audit log", "history", { primary: true, keywords: ["activity", "security"] }),
      link("/dev/integrations", "Integrations", "plug-circle", { keywords: ["email", "sms", "redis", "queue"] }),
    ]),
    section("system", "System", [link("/dev/settings", "Settings", "settings")]),
  ],
};

// -----------------------------------------------------------------------------
// Flattened view (search, titles, bottom pill)
// -----------------------------------------------------------------------------
export type NavEntry = {
  href: string;
  /** Row label, e.g. "All students". */
  label: string;
  /** Page title, e.g. "Students". Falls back to the label. */
  title: string;
  /** Solar base name, or a ready-made node for callers that pass one. */
  icon: SidebarLeafItem["icon"];
  /** Parent group label for child rows, e.g. "Students". */
  group?: string;
  /** Section label, e.g. "People". */
  section: string;
  keywords: string[];
  primary: boolean;
};

const flatCache = new Map<Portal, NavEntry[]>();

/** Every routable row of a portal's menu, in display order (children included). */
export function flattenNav(portal: Portal): NavEntry[] {
  const cached = flatCache.get(portal);
  if (cached) return cached;

  const entries: NavEntry[] = [];
  for (const sec of NAV[portal]) {
    const secLabel = sec.label ?? sec.key;
    for (const item of sec.items) {
      if (item.type === "link") {
        entries.push({
          href: item.href,
          label: item.label,
          title: item.title ?? item.label,
          icon: item.icon,
          section: secLabel,
          keywords: item.keywords ?? [],
          primary: Boolean(item.primary),
        });
      } else {
        item.children.forEach((child, index) => {
          entries.push({
            href: child.href,
            label: child.label,
            title: child.title ?? child.label,
            icon: item.icon,
            group: item.label,
            section: secLabel,
            keywords: item.keywords ?? [],
            // A primary group is represented in the pill by its first child only.
            primary: Boolean(item.primary) && index === 0,
          });
        });
      }
    }
  }
  flatCache.set(portal, entries);
  return entries;
}

// -----------------------------------------------------------------------------
// Active-route rule (used by the Sidebar, the bottom pill and the page title)
// -----------------------------------------------------------------------------
//   1. A row "matches" a pathname when the pathname equals its href, or starts
//      with `href + "/"` (so /dashboard/students/123 matches /dashboard/students).
//   2. EXCEPTION: a portal's landing page (/dashboard, /admin, /teach, /learn,
//      /family, /dev) matches ONLY exactly. Otherwise "Overview" would light up
//      on every page of the portal.
//   3. If several rows match, the LONGEST href wins, and only that one is
//      active. So /dashboard/students/allocation activates "Allocation" and NOT
//      "All students"; /dashboard/payments/events/maintenance activates
//      "Event maintenance" and not "Events".
//   4. A group is "active" when one of its children is the active row.
// -----------------------------------------------------------------------------
const INDEX_ROUTES = new Set<string>(Object.values(PORTAL_HOME));

function cleanPath(pathname: string): string {
  const [path] = pathname.split(/[?#]/);
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function hrefMatches(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (INDEX_ROUTES.has(href)) return false;
  return pathname.startsWith(`${href}/`);
}

/** The single active href of a portal's menu for this pathname, or null. */
export function activeNavHref(portal: Portal, pathname: string): string | null {
  const path = cleanPath(pathname);
  let best: string | null = null;
  for (const entry of flattenNav(portal)) {
    if (hrefMatches(path, entry.href) && (best === null || entry.href.length > best.length)) {
      best = entry.href;
    }
  }
  return best;
}

/** The menu row for the current page (deepest match), used for the page title. */
export function findNavItem(portal: Portal, pathname: string): NavEntry | null {
  const href = activeNavHref(portal, pathname);
  if (!href) return null;
  return flattenNav(portal).find((entry) => entry.href === href) ?? null;
}

// -----------------------------------------------------------------------------
// Bottom pill, bell and search helpers
// -----------------------------------------------------------------------------
/** Up to `max` destinations for the mobile bottom pill (flagged `primary`, else the first ones). */
export function primaryNav(portal: Portal, max = 4): NavEntry[] {
  const all = flattenNav(portal);
  const flagged = all.filter((entry) => entry.primary);
  return (flagged.length > 0 ? flagged : all).slice(0, max);
}

/** Where the top-bar bell should link, or null when the portal has no such page. */
export function notificationsHref(portal: Portal): string | null {
  const entries = flattenNav(portal);
  for (const suffix of ["/notifications", "/notices", "/inbox"]) {
    const hit = entries.find((entry) => entry.href.endsWith(suffix));
    if (hit) return hit.href;
  }
  return null;
}

/** The portal's settings page, if it has one. */
export function settingsHref(portal: Portal): string | null {
  return flattenNav(portal).find((entry) => entry.href.endsWith("/settings"))?.href ?? null;
}

/**
 * Client-side page jump. Every word of the query must appear in the row's
 * label, group, section or keywords. Rows whose label starts with the query
 * come first. An empty query returns the primary rows as suggestions.
 */
export function searchNav(portal: Portal, query: string, limit = 8): NavEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const all = flattenNav(portal);
  if (words.length === 0) {
    return primaryNav(portal, limit);
  }

  const scored: Array<{ entry: NavEntry; score: number }> = [];
  for (const entry of all) {
    const haystack = [entry.label, entry.title, entry.group ?? "", entry.section, ...entry.keywords]
      .join(" ")
      .toLowerCase();
    if (!words.every((word) => haystack.includes(word))) continue;
    const label = entry.label.toLowerCase();
    const score = label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2;
    scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((row) => row.entry);
}

/** Turn "grades-reports" into "Grades Reports" - fallback title for pages outside the menu. */
export function prettifySegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Malformed escape sequence: use the raw segment.
  }
  const words = decoded.split(/[-_]/).filter(Boolean);
  if (words.length === 0) return "";
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
