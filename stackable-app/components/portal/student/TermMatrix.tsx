"use client";

// "Progress by term": a report-card grid (subjects down, terms across, one letter per
// cell). This is the letters-only stand-in for a score trend line: it shows how each
// subject moved from term to term using the real letters, without inventing numbers.
// Zebra rows by tone, no divider lines; scrolls sideways on phones.

import type { GradeRow } from "@/lib/repositories/portal-types";
import { isNewer } from "./helpers";
import { GradeBadge } from "./parts";

export function TermMatrix({ rows, terms }: { rows: GradeRow[]; terms: string[] }) {
  // subject -> term -> newest report
  const cell = new Map<string, Map<string, GradeRow>>();
  const displayName = new Map<string, string>();
  for (const r of rows) {
    const key = r.subject.trim().toLowerCase();
    displayName.set(key, r.subject);
    const perTerm = cell.get(key) ?? new Map<string, GradeRow>();
    const existing = perTerm.get(r.term);
    if (!existing || isNewer(r, existing)) perTerm.set(r.term, r);
    cell.set(key, perTerm);
  }
  const subjects = Array.from(cell.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="w-full min-w-[320px] text-sm">
        <caption className="sr-only">Letter grade for each subject in each term</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="bg-recessed px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-muted first:rounded-l-xl"
            >
              Subject
            </th>
            {terms.map((t) => (
              <th
                key={t}
                scope="col"
                className="bg-recessed px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap text-muted last:rounded-r-xl"
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((key) => (
            <tr key={key} className="odd:bg-surface even:bg-recessed/50">
              <td className="px-3 py-2.5 font-semibold text-ink">{displayName.get(key)}</td>
              {terms.map((t) => (
                <td key={t} className="px-3 py-2.5 text-center">
                  <GradeBadge grade={cell.get(key)?.get(t)?.grade} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
