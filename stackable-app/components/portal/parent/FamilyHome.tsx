"use client";

// =============================================================================
// Parent home (/family). Data: useParentChildren() (GET /api/parent/children).
//
// Layout (same skeleton as the teacher/student homes): main column (welcome, family KPI
// strip, one rich card per child) + a right rail (latest grade updates, quick links) on
// xl+; one stacked column on phones. The shell renders the page <h1>; card titles are h2.
//
// Letters-only data: the family attendance KPI averages only the children that HAVE an
// attendance rate and says "Not recorded yet" otherwise; nothing shows 0%. No linked
// child -> a friendly EmptyState. A failed background refetch keeps the last good data.
// =============================================================================

import Link from "next/link";
import StatCard from "@/components/cards/card";
import { Avatar, Button, EmptyState, Icon } from "@/components/ui";
import { useMe } from "@/hooks/useMe";
import { useParentChildren } from "@/hooks/useParentChildren";
import type { ChildCard } from "@/lib/repositories/portal-types";
import { formatLongDate, greetingFor, useEpochMinute } from "../student/clock";
import { attendanceTone, errorMessage, formatPct, greetingName, pluralize } from "../student/helpers";
import { GradeBadge, PortalWelcome, TINT, type Tint } from "../student/parts";
import { Panel, PanelEmpty, QueryError, stagger } from "../student/Panel";
import { ChildCardFull } from "./ChildCardView";
import { FamilyHomeSkeleton } from "./FamilySkeletons";
import { childName, familyAttendance, familyAverage, gradedCount, totalSubjects } from "./helpers";

// ---- Right rail --------------------------------------------------------------
function GradeUpdates({ kids }: { kids: ChildCard[] }) {
  const updates = kids.filter((c) => c.latestGrade !== null);
  return (
    <Panel
      title="Latest grade updates"
      description={updates.length > 0 ? "The newest report for each child." : undefined}
      style={stagger(2)}
    >
      {updates.length === 0 ? (
        <PanelEmpty icon="solar:chart-square-linear">
          No grade updates yet. When teachers record grades, the newest one for each child shows here.
        </PanelEmpty>
      ) : (
        <ul className="space-y-2">
          {updates.map((child, i) => {
            const latest = child.latestGrade as NonNullable<ChildCard["latestGrade"]>;
            return (
              <li key={child.studentId} style={stagger(i, 50)} className="animate-fade-up">
                <Link
                  href={`/family/children/${child.studentId}`}
                  className="flex items-center gap-3 rounded-xl bg-recessed/60 p-3 transition-colors duration-300 ease-standard hover:bg-recessed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Avatar name={childName(child)} src={child.profilePicture} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{child.firstName ?? childName(child)}</span>
                    <span className="block truncate text-xs text-muted">
                      {latest.subject}
                      {latest.term ? ` · ${latest.term}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {latest.normalizedPct != null ? (
                      <span className="text-xs font-medium tabular-nums text-ink-soft">{formatPct(latest.normalizedPct)}</span>
                    ) : null}
                    <GradeBadge grade={latest.grade} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const LINKS = [
  { href: "/family/children", label: "My children", icon: "solar:users-group-rounded-linear", variant: "accent" },
  { href: "/family/fees", label: "School fees", icon: "solar:wallet-money-linear", variant: "secondary" },
  { href: "/family/notices", label: "Notices", icon: "solar:bell-bing-linear", variant: "secondary" },
  { href: "/family/inbox", label: "Inbox", icon: "solar:inbox-linear", variant: "secondary" },
] as const;

// Only pages that exist in lib/nav.ts (unbuilt ones are ComingSoon pages). Gold is used once.
function QuickLinks() {
  return (
    <Panel title="Quick links" style={stagger(4)}>
      <div className="grid grid-cols-2 gap-2.5">
        {LINKS.map((link, i) => (
          <div key={link.href} style={stagger(i, 50)} className="animate-fade-up">
            <Button as="a" href={link.href} variant={link.variant} leftIcon={link.icon} fullWidth>
              {link.label}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---- Welcome aside: who is in the family --------------------------------------
function FamilyBlock({ kids }: { kids: ChildCard[] }) {
  const shown = kids.slice(0, 4);
  return (
    <div className="w-full shrink-0 rounded-xl bg-recessed p-4 md:w-64">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
        <Icon icon="solar:users-group-rounded-linear" width={14} />
        Your family
      </p>
      <p className="mt-2 font-display text-lg font-semibold text-ink">{pluralize(kids.length, "child", "children")}</p>
      <div className="mt-2 flex -space-x-2">
        {shown.map((c) => (
          <Avatar key={c.studentId} name={childName(c)} src={c.profilePicture} size="sm" className="rounded-full ring-2 ring-recessed" />
        ))}
        {kids.length > shown.length ? (
          <span className="grid size-8 place-items-center rounded-full bg-surface text-xs font-semibold text-ink-soft ring-2 ring-recessed">
            +{kids.length - shown.length}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const ATTENDANCE_TINT: Record<"success" | "warning" | "danger", Tint> = {
  success: "success",
  warning: "warning",
  danger: "danger",
};

function FamilyHomeBody({ kids }: { kids: ChildCard[] }) {
  const epochMinute = useEpochMinute();
  const me = useMe();
  const attendance = familyAttendance(kids);
  const average = familyAverage(kids);
  const graded = gradedCount(kids);
  const attTint = TINT[attendance.rate == null ? "success" : ATTENDANCE_TINT[attendanceTone(attendance.rate)]];

  const kpis = [
    {
      label: "Children",
      value: kids.length,
      icon: "solar:users-group-rounded-linear",
      iconBg: TINT.primary.bg,
      iconColor: TINT.primary.ink,
      delta: undefined,
      animate: true,
    },
    {
      label: "Attendance",
      value: attendance.rate == null ? "-" : `${attendance.rate}%`,
      icon: "solar:clipboard-check-linear",
      iconBg: attTint.bg,
      iconColor: attTint.ink,
      delta:
        attendance.rate == null
          ? "Not recorded yet"
          : kids.length > 1
            ? `${attendance.counted} of ${kids.length} children`
            : undefined,
      animate: true,
    },
    {
      label: "Children with grades",
      value: graded,
      icon: "solar:medal-ribbon-linear",
      iconBg: TINT.success.bg,
      iconColor: TINT.success.ink,
      delta: average != null ? `${Math.round(average)}% average` : `of ${kids.length}`,
      animate: true,
    },
    {
      label: "Subjects followed",
      value: totalSubjects(kids),
      icon: "solar:book-2-linear",
      iconBg: TINT.info.bg,
      iconColor: TINT.info.ink,
      delta: undefined,
      animate: true,
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <PortalWelcome
          roleLabel="Parent"
          roleIcon="solar:user-hands-linear"
          greeting={greetingFor(epochMinute)}
          name={greetingName(me.data?.firstName, me.data?.lastName)}
          meta={[
            { icon: "solar:buildings-2-linear", text: me.data?.schoolName ?? "" },
            { icon: "solar:calendar-linear", text: formatLongDate("", epochMinute) },
          ]}
          aside={<FamilyBlock kids={kids} />}
        />

        <section aria-label="Family key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div key={kpi.label} style={stagger(i + 1)} className="animate-fade-up">
              <StatCard
                icon={<Icon icon={kpi.icon} width={20} />}
                value={kpi.value}
                label={kpi.label}
                delta={kpi.delta}
                iconBg={kpi.iconBg}
                iconColor={kpi.iconColor}
                animate={kpi.animate}
              />
            </div>
          ))}
        </section>

        <section aria-labelledby="children-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="children-heading" className="font-display text-base font-semibold tracking-tight text-ink">
                Your children
              </h2>
              <p className="mt-0.5 text-xs text-muted">Open a profile for grades and attendance.</p>
            </div>
            {kids.length > 2 ? (
              <Button as="a" href="/family/children" variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
                All children
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {kids.map((child, i) => (
              <ChildCardFull key={child.studentId} child={child} index={i + 4} />
            ))}
          </div>
        </section>
      </div>

      <aside aria-label="Grade updates and quick links" className="flex min-w-0 flex-col gap-6">
        <GradeUpdates kids={kids} />
        <QuickLinks />
      </aside>
    </div>
  );
}

export default function FamilyHome() {
  const query = useParentChildren();
  const kids = query.data;

  // A failed background refresh keeps showing the last good data (quiet); only a
  // failure with nothing to show becomes the page-level error.
  if (query.isError && !kids) {
    return (
      <QueryError
        title="We could not load your children"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!kids) return <FamilyHomeSkeleton />;

  if (kids.length === 0) {
    return (
      <div className="animate-fade-up rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:users-group-rounded-linear"
          title="No children linked yet"
          description="No children are linked to your account yet. Please contact your school office and they will link them for you."
          action={
            <Button
              variant="secondary"
              leftIcon="solar:refresh-linear"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Check again
            </Button>
          }
        />
      </div>
    );
  }

  return <FamilyHomeBody kids={kids} />;
}
