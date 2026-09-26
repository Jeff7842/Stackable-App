"use client";

import { BookOpenText, CalendarCheck, CalendarX, TrendingUp } from "lucide-react";
import StatCard from "@/components/cards/card";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";

// ── Grade badge ─────────────────────────────────────────────────────────────
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

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200 ${className ?? ""}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-red-50 p-6 text-red-700 shadow-sm">
      <p className="font-semibold">Failed to load dashboard</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
  const { data, isLoading, isError, error } = useStudentDashboard();

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return <ErrorCard message={msg} />;
  }

  if (!data) return null;

  const { student, subjectCount, grades, attendance } = data;
  const recentGrades = grades.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <h1 className="font-bold text-[22px] mt-[10px]">My Dashboard</h1>

      {/* Welcome banner */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-gray-800">
            Welcome back, {student.firstName ?? student.lastName}!
          </p>
          {student.className && (
            <p className="text-sm text-gray-500 mt-0.5">Class: {student.className}</p>
          )}
        </div>
        {student.averageGrade && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Average Grade</span>
            <GradeBadge grade={student.averageGrade} />
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<BookOpenText className="h-5 w-5" strokeWidth={1.75} />}
          value={String(subjectCount)}
          label="Subjects"
          delta="Enrolled"
          iconBg="bg-blue-100/60"
          iconColor="text-blue-600"
          deltaStatus="neutral"
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" strokeWidth={1.75} />}
          value={String(attendance.present)}
          label="Present Days"
          delta={`${attendance.rate}% rate`}
          iconBg="bg-green-100/60"
          iconColor="text-green-600"
          deltaStatus="positive"
        />
        <StatCard
          icon={<CalendarX className="h-5 w-5" strokeWidth={1.75} />}
          value={String(attendance.absent)}
          label="Absent Days"
          delta={attendance.absent === 0 ? "Perfect!" : "Missed"}
          iconBg="bg-red-100/60"
          iconColor="text-red-500"
          deltaStatus={attendance.absent === 0 ? "positive" : "negative"}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" strokeWidth={1.75} />}
          value={`${attendance.rate}%`}
          label="Attendance Rate"
          delta={attendance.rate >= 80 ? "Good" : "Low"}
          iconBg="bg-teal-100/60"
          iconColor="text-teal-600"
          deltaStatus={attendance.rate >= 80 ? "positive" : "negative"}
        />
      </div>

      {/* Recent grades table */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Grades</h2>
        {recentGrades.length === 0 ? (
          <p className="text-sm text-gray-500">No grades recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Subject</th>
                  <th className="pb-3 pr-4 font-medium">Term</th>
                  <th className="pb-3 pr-4 font-medium">Grade</th>
                  <th className="pb-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentGrades.map((g, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-800">{g.subject}</td>
                    <td className="py-3 pr-4 text-gray-600">{g.term}</td>
                    <td className="py-3 pr-4">
                      <GradeBadge grade={g.grade} />
                    </td>
                    <td className="py-3 text-gray-600">
                      {g.rawScore != null ? g.rawScore : "—"}
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
