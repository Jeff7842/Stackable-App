"use client";

// =============================================================================
// Student home (/learn). Composition only: data comes from useStudentDashboard()
// (GET /api/student/dashboard), every section is its own component in this folder.
//
// Layout (same skeleton as the teacher home): main column (welcome, KPI strip,
// progress at a glance, subjects) + a right rail (today's timetable, latest grades,
// quick links) on xl+; one stacked column on phones. The shell already renders the
// page <h1> ("Home"), so nothing here renders an h1; card titles are h2.
//
// Letters-only data: today the school records letter grades only, so averages and
// attendance rates are usually null. The KPI strip leads with the LETTER, rings and
// percentages appear only when real numbers exist, and "no attendance recorded yet"
// is said in words. A failed background refetch keeps the last good data on screen.
// =============================================================================

import StatCard from "@/components/cards/card";
import { Icon } from "@/components/ui";
import { useMe } from "@/hooks/useMe";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import type { LessonSlot, StudentDashboardData } from "@/lib/repositories/portal-types";
import {
  formatLongDate,
  greetingFor,
  isBreakSlot,
  lessonPhase,
  lessonTitle,
  nairobiMinuteOfDay,
  useEpochMinute,
} from "./clock";
import {
  attendanceRate,
  attendanceTone,
  buildSubjectCards,
  errorMessage,
  gradeMix,
  greetingName,
  sortNewestFirst,
  summarizeGrades,
} from "./helpers";
import { LatestGrades } from "./LatestGrades";
import { FocusBlock, PortalWelcome, TINT, bandTint, type Focus, type Tint } from "./parts";
import { QueryError, stagger } from "./Panel";
import { ProgressPanel } from "./ProgressPanel";
import { QuickLinks } from "./QuickLinks";
import { StudentHomeSkeleton } from "./StudentHomeSkeleton";
import { SubjectsGrid } from "./SubjectsGrid";
import { UpcomingPanel } from "./UpcomingPanel";

/** What the welcome card's focus block should say, from today's slots and the clock. */
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
      meta: [running.teacherName, running.room, `until ${running.endTime}`].filter(Boolean).join(" · "),
    };
  }
  const next = lessons.find((slot) => lessonPhase(slot, nowMin) === "upcoming");
  if (next) {
    return {
      kind: "next",
      label: "Up next",
      title: lessonTitle(next),
      meta: [next.startTime, next.teacherName, next.room].filter(Boolean).join(" · "),
    };
  }
  return { kind: "idle", label: "Today", title: "All done for today", meta: `${lessons.length} slots completed.` };
}

const ATTENDANCE_TINT: Record<"success" | "warning" | "danger", Tint> = {
  success: "success",
  warning: "warning",
  danger: "danger",
};

function StudentHomeBody({ data }: { data: StudentDashboardData }) {
  const epochMinute = useEpochMinute();
  const me = useMe();
  const { student, grades, attendance, subjects, today } = data;

  const nowMin = epochMinute ? nairobiMinuteOfDay(epochMinute) : null;
  const newestFirst = sortNewestFirst(grades);
  const summary = summarizeGrades(grades, student.averageGrade);
  const mix = gradeMix(grades);
  const cards = buildSubjectCards(subjects, grades);
  const rate = attendanceRate(attendance);
  const lessons = today.lessons;
  const teachingLessons = lessons.filter((slot) => !isBreakSlot(slot));
  const nextLesson =
    nowMin == null ? undefined : teachingLessons.find((slot) => lessonPhase(slot, nowMin) === "upcoming");

  const overallTint = summary.overall ? TINT[bandTint(summary.overall)] : TINT.primary;
  const attendanceTint = TINT[rate == null ? "success" : ATTENDANCE_TINT[attendanceTone(rate)]];

  const kpis = [
    {
      label: "Overall grade",
      value: summary.overall ?? "-",
      icon: "solar:medal-ribbon-linear",
      iconBg: overallTint.bg,
      iconColor: overallTint.ink,
      delta: summary.averagePct != null ? `${Math.round(summary.averagePct)}% average` : undefined,
      animate: false,
    },
    {
      label: "Attendance",
      value: rate == null ? "-" : `${rate}%`,
      icon: "solar:clipboard-check-linear",
      iconBg: attendanceTint.bg,
      iconColor: attendanceTint.ink,
      delta: rate == null ? "Not recorded yet" : `${attendance.present + attendance.late} of ${attendance.total} days`,
      animate: true,
    },
    {
      label: "Subjects",
      value: Math.max(data.subjectCount, cards.length),
      icon: "solar:book-2-linear",
      iconBg: TINT.info.bg,
      iconColor: TINT.info.ink,
      delta: undefined,
      animate: true,
    },
    {
      label: "Lessons today",
      value: teachingLessons.length,
      icon: "solar:clock-circle-linear",
      iconBg: TINT.accent.bg,
      iconColor: TINT.accent.ink,
      delta: nextLesson ? `Next ${nextLesson.startTime}` : undefined,
      animate: true,
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <PortalWelcome
          roleLabel="Student"
          roleIcon="solar:square-academic-cap-linear"
          greeting={greetingFor(epochMinute)}
          name={greetingName(student.firstName, student.lastName)}
          meta={[
            { icon: "solar:widget-2-linear", text: student.className ?? "" },
            { icon: "solar:buildings-2-linear", text: me.data?.schoolName ?? "" },
            {
              icon: "solar:user-rounded-linear",
              text: student.classTeacherName ? `Class teacher ${student.classTeacherName}` : "",
            },
            { icon: "solar:calendar-linear", text: formatLongDate(today.date, epochMinute) },
          ]}
          aside={<FocusBlock focus={buildFocus(lessons, nowMin)} />}
        />

        <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

        <ProgressPanel summary={summary} mix={mix} attendance={attendance} style={stagger(5)} />
        <SubjectsGrid cards={cards} style={stagger(6)} />
      </div>

      <aside aria-label="Today, latest grades and quick links" className="flex min-w-0 flex-col gap-6">
        <UpcomingPanel today={today} nowMin={nowMin} style={stagger(2)} />
        <LatestGrades grades={newestFirst} epochMinute={epochMinute} style={stagger(4)} />
        <QuickLinks style={stagger(6)} />
      </aside>
    </div>
  );
}

export default function StudentHome() {
  const query = useStudentDashboard();
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
  if (!data) return <StudentHomeSkeleton />;
  return <StudentHomeBody data={data} />;
}
