"use client";

// Grade visuals shared by the student grades page and the parent's child profile.
//   - Score trend (AreaChart) ONLY when at least two terms carry a real average score.
//   - With letters only, and two or more terms: "Progress by term" (letter grid).
//   - "Grade mix" donut: always, when there is at least one report.
// Charts read their colours through the chart theme (tokens); nothing is invented.

import type { CSSProperties } from "react";
import { AreaChart, BarChart } from "@/components/ui/Chart";
import type { GradeRow } from "@/lib/repositories/portal-types";
import { cn } from "@/lib/cn";
import { gradeMix, meanOf, overallGrade, scoreTrend, termsOf } from "./helpers";
import { GradeMixBlock } from "./parts";
import { Panel } from "./Panel";
import { TermMatrix } from "./TermMatrix";

export function GradeInsights({
  rows,
  trendRows = rows,
  seriesName = "Average score",
  showSubjectBars = false,
  style,
}: {
  /** The reports the grade mix describes (after every filter). */
  rows: GradeRow[];
  /** The reports the term-by-term view describes (usually not filtered by term). */
  trendRows?: GradeRow[];
  seriesName?: string;
  /** Also draw average score per subject as bars (only when real scores exist). */
  showSubjectBars?: boolean;
  style?: CSSProperties;
}) {
  const trend = scoreTrend(trendRows);
  const terms = termsOf(trendRows);
  const mix = gradeMix(rows);
  const overall = overallGrade(rows);

  // Average score per subject: real numbers only.
  const bySubject = new Map<string, GradeRow[]>();
  for (const r of rows) bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r]);
  const bars = Array.from(bySubject.entries())
    .map(([subject, list]) => ({ subject, value: meanOf(list.map((r) => r.normalizedPct)) }))
    .filter((b): b is { subject: string; value: number } => b.value !== null)
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const hasTrendPanel = trend !== null || terms.length >= 2;

  return (
    <div style={style} className={cn("grid gap-6", hasTrendPanel && "lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start")}>
      {trend ? (
        <Panel title="Score trend" description="Average score by term.">
          <AreaChart
            categories={trend.categories}
            series={[{ name: seriesName, data: trend.data }]}
            yMax={100}
            height={240}
          />
          {showSubjectBars && bars.length > 1 ? (
            <div className="mt-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">By subject</h3>
              <BarChart
                categories={bars.map((b) => b.subject)}
                series={[{ name: "Average score", data: bars.map((b) => b.value) }]}
                yMax={100}
                height={200}
              />
            </div>
          ) : null}
        </Panel>
      ) : terms.length >= 2 ? (
        <Panel title="Progress by term" description="Your letter in each subject, term by term.">
          <TermMatrix rows={trendRows} terms={terms} />
        </Panel>
      ) : null}

      <Panel
        title="Grade mix"
        description={rows.length > 0 ? "How the reports split into strong, fair and needs support." : undefined}
      >
        <GradeMixBlock mix={mix} overall={overall} layout={hasTrendPanel ? "stack" : "side"} />
      </Panel>
    </div>
  );
}
