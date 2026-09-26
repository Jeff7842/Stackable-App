"use client";

import React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useParentChildren } from "@/hooks/useParentChildren";
import type { ChildCard } from "@/lib/repositories/parent.repo";

// ─── helpers ──────────────────────────────────────────────────────────────────

function gradeColor(grade: string | null): string {
  if (!grade) return "bg-gray-100 text-gray-500";
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "bg-green-100 text-green-700";
  if (g.startsWith("B")) return "bg-teal-100 text-teal-700";
  if (g.startsWith("C")) return "bg-yellow-100 text-yellow-700";
  if (g.startsWith("D")) return "bg-orange-100 text-orange-700";
  if (g.startsWith("F")) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-500";
}

function initials(first: string | null, last: string): string {
  return `${first ? first[0] : ""}${last[0] ?? ""}`.toUpperCase();
}

// ─── child card ───────────────────────────────────────────────────────────────

function ChildCardItem({ child }: { child: ChildCard }) {
  const fullName = [child.firstName, child.lastName].filter(Boolean).join(" ");

  return (
    <Link href={`/family/children/${child.studentId}`} className="block group">
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-5 hover:shadow-md transition-shadow cursor-pointer">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          {child.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={child.profilePicture}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-[#108548] text-white flex items-center justify-center text-xl font-semibold shrink-0">
              {initials(child.firstName, child.lastName)}
            </div>
          )}

          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-lg truncate">{fullName}</p>
            {child.className && (
              <p className="text-sm text-gray-500 truncate">{child.className}</p>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          {/* Grade badge */}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              child.averageGrade
                ? gradeColor(child.averageGrade)
                : "bg-[#ffc300]/20 text-[#7a5c00]"
            }`}
          >
            {child.averageGrade ? `Grade ${child.averageGrade}` : "N/A"}
          </span>

          {/* Relationship tag */}
          <span className="text-gray-400 text-xs capitalize">
            {child.relationship}
          </span>
        </div>

        {/* Admission number */}
        <p className="text-xs text-gray-400">{child.admissionNo}</p>
      </div>
    </Link>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-gray-200 rounded-full w-16" />
        <div className="h-5 bg-gray-200 rounded-full w-12" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/3" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AllChildrenPage() {
  const { data: children, isLoading, isError, error } = useParentChildren();

  return (
    <div className="bg-[#F6F6F6] px-2">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">All Children</h1>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="bg-white rounded-2xl shadow-sm p-6 max-w-md">
          <p className="font-semibold text-red-600 mb-2">Failed to load children</p>
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

      {/* Empty state */}
      {!isLoading && !isError && children && children.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <p className="font-semibold text-lg text-gray-700">No children linked yet</p>
          <p className="text-sm text-gray-500 max-w-xs">
            No children are currently linked to your account. Please contact the school
            administration for assistance.
          </p>
        </div>
      )}

      {/* Children grid */}
      {!isLoading && !isError && children && children.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {children.map((child) => (
            <ChildCardItem key={child.studentId} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
