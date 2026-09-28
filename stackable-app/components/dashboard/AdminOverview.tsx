"use client";

// =============================================================================
// AdminOverview - the school overview shared by /admin and /dashboard (both
// pages just render this component, so they are identical by construction).
//
// Layout: greeting card, a 5-card KPI strip, then a main column (attendance
// today + 7-day trend, class performance, recent grade reports) beside a right
// rail (recent activity). One column on phones.
//
// Data: useAdminOverview() (GET /api/admin/overview), refetched quietly every
// minute and on window focus. A failed background refresh keeps the last good
// data on screen; only a failure with nothing to show becomes the page error.
// The shell's navbar already renders the page <h1> ("Overview"), so this page
// has no h1; card titles are h2.
// =============================================================================

import StatCard from "@/components/cards/card";
import { formatRole } from "@/components/dashboard/format";
import { Icon } from "@/components/ui";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useMe } from "@/hooks/useMe";
import { ActivityFeed } from "@/components/portal/admin/ActivityFeed";
import { AdminGreeting } from "@/components/portal/admin/AdminGreeting";
import { AdminOverviewSkeleton } from "@/components/portal/admin/AdminOverviewSkeleton";
import { AttendanceToday } from "@/components/portal/admin/AttendanceToday";
import { AttendanceTrend } from "@/components/portal/admin/AttendanceTrend";
import { ClassPerformance } from "@/components/portal/admin/ClassPerformance";
import { RecentGrades } from "@/components/portal/admin/RecentGrades";
import { QueryError, stagger } from "@/components/portal/admin/Panel";
import {
  errorMessage,
  firstNameOf,
  formatToday,
  greetingFor,
  timeAgo,
  useEpochMinute,
} from "@/components/portal/admin/helpers";

const KPI_META = [
  { key: "students", label: "Students", icon: "solar:square-academic-cap-linear", bg: "bg-primary-tint", ink: "text-primary-ink" },
  { key: "teachers", label: "Teachers", icon: "solar:users-group-two-rounded-linear", bg: "bg-info-tint", ink: "text-info" },
  { key: "classes", label: "Classes", icon: "solar:widget-2-linear", bg: "bg-success-tint", ink: "text-success" },
  { key: "subjects", label: "Subjects", icon: "solar:book-2-linear", bg: "bg-accent-tint", ink: "text-accent-ink" },
  { key: "parents", label: "Parents", icon: "solar:user-hands-linear", bg: "bg-warning-tint", ink: "text-warning" },
] as const;

export default function AdminOverview() {
  const query = useAdminOverview();
  const me = useMe();
  const epochMinute = useEpochMinute();
  const data = query.data;

  if (query.isError && !data) {
    return (
      <QueryError
        title="We could not load the overview"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!data) return <AdminOverviewSkeleton />;

  const ago = query.dataUpdatedAt ? timeAgo(new Date(query.dataUpdatedAt).toISOString(), epochMinute) : "";
  const schoolName = data.school.name || me.data?.schoolName || "";

  return (
    <div className="flex flex-col gap-6">
      <AdminGreeting
        greeting={greetingFor(epochMinute)}
        firstName={firstNameOf(me.data?.firstName)}
        roleLabel={formatRole(me.data?.role, "principal")}
        schoolName={schoolName}
        dateLabel={formatToday(epochMinute)}
        updatedLabel={ago ? `Updated ${ago.toLowerCase()}` : ""}
        refreshing={query.isFetching}
        onRefresh={() => void query.refetch()}
      />

      <section aria-label="School totals" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {KPI_META.map((kpi, i) => (
          // The odd fifth card spans both columns on phones so the grid has no orphan.
          <div key={kpi.key} style={stagger(i + 1)} className="animate-fade-up last:col-span-2 lg:last:col-span-1">
            <StatCard
              icon={<Icon icon={kpi.icon} width={20} />}
              value={data.totals[kpi.key]}
              label={kpi.label}
              iconBg={kpi.bg}
              iconColor={kpi.ink}
              animate
            />
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <AttendanceToday attendance={data.attendanceToday} style={stagger(6)} />
            <AttendanceTrend days={data.attendanceTrend} style={stagger(7)} />
          </div>
          <ClassPerformance classes={data.classPerformance} style={stagger(8)} />
          <RecentGrades grades={data.recentGrades} epochMinute={epochMinute} style={stagger(9)} />
        </div>

        <aside aria-label="Recent activity" className="min-w-0">
          <ActivityFeed items={data.recentActivity} epochMinute={epochMinute} style={stagger(7)} />
        </aside>
      </div>
    </div>
  );
}
