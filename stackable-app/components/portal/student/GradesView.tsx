"use client";

// =============================================================================
// Student grades page body (/learn/grades). Data: useStudentGrades()
// (GET /api/student/grades).
//
//   1. summary tiles: overall grade, best subject, needs attention, reports
//   2. GradeInsights: score trend (only with real scores across 2+ terms), else the
//      letter grid by term, plus the grade-mix donut
//   3. DataTable: subject / term / grade / (score) / performance / recorded, with a
//      term filter and a subject filter (Select). `?subject=<name>` pre-selects the
//      subject filter (the home page's subject tiles link here).
//
// Letters-only today: no percentages or trend lines are drawn unless real numbers
// exist. A failed background refetch keeps the last good data.
// =============================================================================

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatedNumber, Button, EmptyState, Select } from "@/components/ui";
import { DataTable } from "@/components/ui/DataTable";
import { useStudentGrades } from "@/hooks/useStudentGrades";
import type { GradeRow } from "@/lib/repositories/portal-types";
import { GradeInsights } from "./GradeInsights";
import { gradeColumns, gradeColumnsWithScore } from "./gradeColumns";
import { GradesSkeleton } from "./GradesSkeleton";
import {
  errorMessage,
  formatPct,
  pluralize,
  sortNewestFirst,
  summarizeGrades,
  termsOf,
} from "./helpers";
import { SummaryTile, bandTint } from "./parts";
import { QueryError, stagger } from "./Panel";

const ALL = "all";

export default function GradesView() {
  const searchParams = useSearchParams();
  const query = useStudentGrades();
  const [term, setTerm] = useState(ALL);
  const [subject, setSubject] = useState(() => searchParams.get("subject") ?? ALL);

  const grades: GradeRow[] = query.data ?? [];

  if (query.isError && !query.data) {
    return (
      <QueryError
        title="We could not load your grades"
        message={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  if (!query.data) return <GradesSkeleton />;

  if (grades.length === 0) {
    return (
      <div className="animate-fade-up rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:chart-square-linear"
          title="No grades yet"
          description="Your grades will appear here once your teachers submit reports."
          action={
            <Button as="a" href="/learn" variant="secondary" leftIcon="solar:arrow-left-linear">
              Back to home
            </Button>
          }
        />
      </div>
    );
  }

  const newestFirst = sortNewestFirst(grades);
  const terms = termsOf(grades).reverse(); // newest term first in the picker
  const subjectNames = Array.from(new Set(grades.map((g) => g.subject))).sort((a, b) => a.localeCompare(b));

  // A stale ?subject= value (or a term that vanished) falls back to "all".
  const activeSubject = subjectNames.includes(subject) ? subject : ALL;
  const activeTerm = terms.includes(term) ? term : ALL;

  const bySubject = newestFirst.filter((g) => activeSubject === ALL || g.subject === activeSubject);
  const filtered = bySubject.filter((g) => activeTerm === ALL || g.term === activeTerm);
  const summary = summarizeGrades(filtered);
  const hasScores = grades.some((g) => g.normalizedPct != null || g.rawScore != null);
  const filtersActive = activeSubject !== ALL || activeTerm !== ALL;

  const overallTint = summary.overall ? bandTint(summary.overall) : "primary";
  const attentionCount = summary.attention.length;
  const graded = summary.best !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {pluralize(grades.length, "report")} across {pluralize(subjectNames.length, "subject")}
        </p>
        <Button
          variant="ghost"
          size="sm"
          leftIcon="solar:refresh-linear"
          loading={query.isFetching}
          onClick={() => void query.refetch()}
          aria-label="Refresh grades"
        >
          Refresh
        </Button>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile
          index={0}
          icon="solar:medal-ribbon-linear"
          label="Overall grade"
          tint={overallTint}
          value={summary.overall ?? "-"}
          sub={summary.averagePct != null ? `${formatPct(summary.averagePct)} average` : "Most common latest letter"}
        />
        <SummaryTile
          index={1}
          icon="solar:cup-star-linear"
          label="Best subject"
          tint="success"
          value={<span title={summary.best?.subject}>{summary.best?.subject ?? "-"}</span>}
          sub={summary.best ? <>Grade {summary.best.grade}</> : "No letters yet"}
        />
        <SummaryTile
          index={2}
          icon={attentionCount > 0 ? "solar:danger-triangle-linear" : "solar:check-circle-linear"}
          label="Needs attention"
          tint={attentionCount > 0 ? "danger" : "success"}
          value={!graded ? "-" : attentionCount > 0 ? pluralize(attentionCount, "subject") : "None"}
          sub={
            !graded
              ? "No letters yet"
              : attentionCount > 0
                ? summary.attention.map((a) => a.subject).join(", ")
                : "All subjects on track"
          }
        />
        <SummaryTile
          index={3}
          icon="solar:document-text-linear"
          label={filtersActive ? "Reports shown" : "Reports"}
          tint="info"
          value={<AnimatedNumber value={filtered.length} />}
          sub={pluralize(summary.subjectCount, "subject")}
        />
      </section>

      <GradeInsights rows={filtered} trendRows={bySubject} seriesName={activeSubject === ALL ? "Average score" : activeSubject} style={stagger(2)} />

      <DataTable<GradeRow>
        columns={hasScores ? gradeColumnsWithScore : gradeColumns}
        data={filtered}
        searchPlaceholder="Search subject, term or grade"
        caption="Your grade reports"
        pageSize={10}
        filters={
          <>
            <Select
              size="sm"
              pill
              aria-label="Filter by term"
              value={activeTerm}
              onChange={(e) => setTerm(e.target.value)}
              className="w-36"
            >
              <option value={ALL}>All terms</option>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              pill
              aria-label="Filter by subject"
              value={activeSubject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-44"
            >
              <option value={ALL}>All subjects</option>
              {subjectNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </>
        }
        emptyState={
          <EmptyState
            icon="solar:magnifer-linear"
            title="No grades match"
            description="Try a different search or clear the filters."
            action={
              filtersActive ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTerm(ALL);
                    setSubject(ALL);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
