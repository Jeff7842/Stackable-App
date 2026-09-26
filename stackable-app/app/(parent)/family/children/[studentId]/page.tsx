"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, XCircle, BarChart2 } from "lucide-react";
import { useChildOverview } from "@/hooks/useChildOverview";
import StatCard from "@/components/cards/card";
import type { ChildOverview } from "@/lib/repositories/parent.repo";

// ─── helpers ──────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "bg-green-100 text-green-700";
  if (g.startsWith("B")) return "bg-teal-100 text-teal-700";
  if (g.startsWith("C")) return "bg-yellow-100 text-yellow-700";
  if (g.startsWith("D")) return "bg-orange-100 text-orange-700";
  if (g.startsWith("F")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    inactive: "bg-red-100 text-red-700",
    suspended: "bg-orange-100 text-orange-700",
  };
  return map[status.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

// ─── grades table ─────────────────────────────────────────────────────────────

type GradeRow = ChildOverview["grades"][number];

function GradesTable({ grades }: { grades: GradeRow[] }) {
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...grades].sort((a, b) => {
    const cmp = a.subject.localeCompare(b.subject);
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (grades.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        No grade reports available yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th
              className="text-left py-3 px-4 text-gray-500 font-medium cursor-pointer select-none hover:text-[#108548] transition-colors"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            >
              Subject {sortDir === "asc" ? "↑" : "↓"}
            </th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Term</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Grade</th>
            <th className="text-right py-3 px-4 text-gray-500 font-medium">Raw Score</th>
            <th className="text-right py-3 px-4 text-gray-500 font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4 font-medium text-gray-800">{row.subject}</td>
              <td className="py-3 px-4 text-gray-600">{row.term}</td>
              <td className="py-3 px-4">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${gradeColor(row.grade)}`}
                >
                  {row.grade}
                </span>
              </td>
              <td className="py-3 px-4 text-right text-gray-700">
                {row.rawScore !== null ? row.rawScore : "—"}
              </td>
              <td className="py-3 px-4 text-right text-gray-700">
                {row.normalizedPct !== null ? `${row.normalizedPct}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-4 items-center">
        <div className="h-16 w-16 rounded-full bg-gray-200 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm h-28" />
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm p-5 h-48" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ChildDetailPage() {
  const params = useParams();
  const studentId =
    typeof params?.studentId === "string" ? params.studentId : undefined;

  const { data, isLoading, isError, error } = useChildOverview(studentId);

  const fullName = data
    ? [data.student.firstName, data.student.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="bg-[#F6F6F6] px-2">
      {/* Back link */}
      <Link
        href="/family"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#108548] transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Children
      </Link>

      <h1 className="font-bold text-[22px] mt-[10px] mb-5">
        {fullName || "Child Overview"}
      </h1>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="bg-white rounded-2xl shadow-sm p-6 max-w-md">
          <p className="font-semibold text-red-600 mb-2">Failed to load student data</p>
          <p className="text-sm text-gray-500 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#108548] text-white text-[13px] font-medium px-4 py-2 hover:bg-[#0d6e3b] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-6">
          {/* Profile header */}
          <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-center gap-4">
            {data.student.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.student.profilePicture}
                alt={fullName}
                className="h-16 w-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-[#e4f9e2] text-[#007146] flex items-center justify-center text-xl font-bold shrink-0">
                {`${data.student.firstName ? data.student.firstName[0] : ""}${data.student.lastName[0] ?? ""}`.toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-[18px]">{fullName}</h2>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${statusBadge(data.student.status)}`}
                >
                  {data.student.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {data.student.className ?? "No class assigned"} &middot;{" "}
                {data.student.admissionNo}
              </p>
            </div>
          </div>

          {/* Attendance stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              value={String(data.attendance.present)}
              label="Days Present"
              delta={`of ${data.attendance.total}`}
              iconBg="bg-green-200/60"
              iconColor="text-green-700"
              deltaStatus="positive"
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              value={String(data.attendance.late)}
              label="Days Late"
              delta={`of ${data.attendance.total}`}
              iconBg="bg-yellow-200/60"
              iconColor="text-yellow-700"
              deltaStatus="neutral"
            />
            <StatCard
              icon={<XCircle className="h-5 w-5" />}
              value={String(data.attendance.absent)}
              label="Days Absent"
              delta={`of ${data.attendance.total}`}
              iconBg="bg-red-200/60"
              iconColor="text-red-700"
              deltaStatus="negative"
            />
            <StatCard
              icon={<BarChart2 className="h-5 w-5" />}
              value={`${data.attendance.rate}%`}
              label="Attendance Rate"
              delta={data.attendance.rate >= 80 ? "Good" : "Needs attention"}
              iconBg="bg-blue-200/60"
              iconColor="text-blue-700"
              deltaStatus={
                data.attendance.rate >= 80
                  ? "positive"
                  : data.attendance.rate >= 60
                    ? "neutral"
                    : "negative"
              }
            />
          </div>

          {/* Grades table */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-[16px] mb-4">Grade Reports</h3>
            <GradesTable grades={data.grades} />
          </div>
        </div>
      )}
    </div>
  );
}
