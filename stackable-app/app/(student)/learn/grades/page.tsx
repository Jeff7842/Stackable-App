"use client";

import { useStudentGrades } from "@/hooks/useStudentGrades";

// ── Grade badge ───────────────────────────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  const upper = grade.toUpperCase();
  const colorMap: Record<string, string> = {
    A: "bg-green-100 text-green-700",
    B: "bg-teal-100 text-teal-700",
    C: "bg-yellow-100 text-yellow-700",
    D: "bg-orange-100 text-orange-700",
    F: "bg-red-100 text-red-700",
  };
  const firstLetter = upper[0] ?? "F";
  const colorClass = colorMap[firstLetter] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${colorClass}`}>
      {grade}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className ?? ""}`} />;
}

function GradesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-6 text-red-700 shadow-sm">
      <p className="font-semibold">Failed to load grades</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentGradesPage() {
  const { data, isLoading, isError, error } = useStudentGrades();

  if (isLoading) return <GradesSkeleton />;

  if (isError) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return <ErrorCard message={msg} />;
  }

  const grades = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-[22px] mt-[10px]">My Grades</h1>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        {grades.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p className="font-medium">No grades recorded yet.</p>
            <p className="text-sm mt-1">Your grades will appear here once teachers submit reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Subject</th>
                  <th className="pb-3 pr-4 font-medium">Term</th>
                  <th className="pb-3 pr-4 font-medium">Grade</th>
                  <th className="pb-3 pr-4 font-medium">Raw Score</th>
                  <th className="pb-3 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {grades.map((g, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-800">{g.subject}</td>
                    <td className="py-3 pr-4 text-gray-600">{g.term}</td>
                    <td className="py-3 pr-4">
                      <GradeBadge grade={g.grade} />
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {g.rawScore != null ? g.rawScore : "—"}
                    </td>
                    <td className="py-3 text-gray-600">
                      {g.normalizedPct != null ? `${g.normalizedPct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
