"use client";

// =============================================================================
// Teacher home (/teach). Composition only: data comes from useTeacherPortal(),
// every section is its own component in this folder.
//
// Layout: main column (banner, KPI strip, today's classes, my classes) + a right
// rail (quick actions, students needing attention, recent grading) on xl+, one
// stacked column on phones. The shell's navbar already renders the page <h1>
// ("Home"), so nothing here renders an h1; section titles are h2.
//
// The "now" marker is computed client-side from the Nairobi clock and refreshed
// about once a minute (useEpochMinute); the data itself refetches quietly every
// 60 s and on window focus (see hooks/useTeacherPortal.ts).
// =============================================================================

import StatCard from "@/components/cards/card";
import { Icon } from "@/components/ui";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";
import { AttentionList } from "./AttentionList";
import { ClassesCard } from "./ClassesCard";
import { QuickActions } from "./QuickActions";
import { RecentGrading } from "./RecentGrading";
import { TeacherHomeSkeleton } from "./TeacherHomeSkeleton";
import { TodayClasses } from "./TodayClasses";
import { WelcomeBanner, type Focus } from "./WelcomeBanner";
import {
  errorMessage,
  firstNameOf,
  formatLongDate,
  greetingFor,
  lessonPhase,
  lessonTitle,
  nairobiMinuteOfDay,
  useEpochMinute,
} from "./helpers";
import { QueryError, stagger } from "./Panel";
import type { LessonSlot } from "@/lib/repositories/portal-types";

/** What the banner's focus block should say, from today's slots and the clock. */
function buildFocus(lessons: LessonSlot[], nowMin: number | null): Focus {
  if (lessons.length === 0) {
    return { kind: "idle", label: "Today", title: "No lessons today", meta: "Your timetable is clear." };
  }
  if (nowMin == null) {
    return { kind: "idle", label: "Today", title: `${lessons.length} on your timetable`, meta: "See the schedule below." };
  }
  const running = lessons.find((slot) => lessonPhase(slot, nowMin) === "now");
  if (running) {
    return {
      kind: "now",
      label: "Happening now",
      title: lessonTitle(running),
      meta: [running.className, running.room, `until ${running.endTime}`].filter(Boolean).join(" · "),
    };
  }
  const next = lessons.find((slot) => lessonPhase(slot, nowMin) === "upcoming");
  if (next) {
    return {
      kind: "next",
      label: "Up next",
      title: lessonTitle(next),
      meta: [next.startTime, next.className, next.room].filter(Boolean).join(" · "),
    };
  }
  return { kind: "idle", label: "Today", title: "All done for today", meta: `${lessons.length} slots completed.` };
}

export default function TeacherHome() {
  const query = useTeacherPortal();
  const epochMinute = useEpochMinute();
  const data = query.data;

  // A failed background refresh keeps showing the last good data (quiet); only a
  // failure with nothing to show becomes the page-level error.
  if (query.isError && !data) {
    return (
      <QueryError
        title="We could not load your dashboard"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!data) return <TeacherHomeSkeleton />;

  const nowMin = epochMinute ? nairobiMinuteOfDay(epochMinute) : null;
  const lessons = data.today.lessons;
  const kpis = [
    {
      label: "My students",
      value: data.studentCount,
      icon: "solar:users-group-rounded-linear",
      iconBg: "bg-primary-tint",
      iconColor: "text-primary-ink",
    },
    {
      label: "My classes",
      value: data.classes.length,
      icon: "solar:widget-2-linear",
      iconBg: "bg-info-tint",
      iconColor: "text-info",
    },
    {
      label: "Lessons today",
      value: lessons.length,
      icon: "solar:clock-circle-linear",
      iconBg: "bg-accent-tint",
      iconColor: "text-accent-ink",
    },
    {
      label: "Subjects",
      value: data.subjects.length,
      icon: "solar:book-2-linear",
      iconBg: "bg-success-tint",
      iconColor: "text-success",
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <WelcomeBanner
          greeting={greetingFor(epochMinute)}
          firstName={firstNameOf(data.teacher.name)}
          schoolName={data.schoolName}
          dateLabel={formatLongDate(data.today.date, epochMinute)}
          focus={buildFocus(lessons, nowMin)}
        />

        <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div key={kpi.label} style={stagger(i + 1)} className="animate-fade-up">
              <StatCard
                icon={<Icon icon={kpi.icon} width={20} />}
                value={kpi.value}
                label={kpi.label}
                iconBg={kpi.iconBg}
                iconColor={kpi.iconColor}
                animate
              />
            </div>
          ))}
        </section>

        <TodayClasses today={data.today} nowMin={nowMin} style={stagger(5)} />
        <ClassesCard classes={data.classes} subjects={data.subjects} style={stagger(6)} />
      </div>

      <aside aria-label="Quick actions and follow-ups" className="flex min-w-0 flex-col gap-6">
        <QuickActions style={stagger(2)} />
        <AttentionList items={data.attention} style={stagger(4)} />
        <RecentGrading entries={data.recentGrading} epochMinute={epochMinute} style={stagger(6)} />
      </aside>
    </div>
  );
}
