"use client";

import React from "react";
import Link from "next/link";
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

// ─── child card component ──────────────────────────────────────────────────────

function ChildCardItem({ child }: { child: ChildCard }) {
  const fullName = [child.firstName, child.lastName].filter(Boolean).join(" ");

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Avatar + name row */}
      <div className="flex items-center gap-4">
        {child.profilePicture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={child.profilePicture}
            alt={fullName}
            className="h-14 w-14 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-[#e4f9e2] text-[#007146] flex items-center justify-center text-lg font-bold shrink-0">
            {initials(child.firstName, child.lastName)}
          </div>
        )}

        <div className="min-w-0">
          <p className="font-semibold text-[15px] truncate">{fullName}</p>
          <p className="text-sm text-gray-500 truncate">{child.admissionNo}</p>
        </div>
      </div>

      {/* Class + badges */}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {child.className && (
          <span className="bg-gray-100 text-gray-600 px-3 py-0.5 rounded-full">
            {child.className}
          </span>
        )}

        {child.averageGrade && (
          <span
            className={`px-3 py-0.5 rounded-full font-medium ${gradeColor(child.averageGrade)}`}
          >
            Grade {child.averageGrade}
          </span>
        )}

        <span className="bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full capitalize">
          {child.relationship}
        </span>
      </div>

      {/* CTA */}
      <Link
        href={`/family/children/${child.studentId}`}
        className="mt-auto inline-flex items-center justify-center rounded-full bg-[#108548] text-white text-[13px] font-medium px-4 py-2 hover:bg-[#0d6e3b] transition-colors"
      >
        View Details
      </Link>
    </div>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 rounded-full w-20" />
        <div className="h-6 bg-gray-200 rounded-full w-16" />
      </div>
      <div className="h-9 bg-gray-200 rounded-full w-full mt-auto" />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const { data: children, isLoading, isError, error } = useParentChildren();

  return (
    <div className="bg-[#F6F6F6] px-2">
      <h1 className="font-bold text-[22px] mt-[10px]">My Children</h1>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6 max-w-md">
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

      {!isLoading && !isError && children && children.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-full bg-[#e4f9e2] flex items-center justify-center text-3xl">
            👨‍👩‍👧
          </div>
          <p className="font-semibold text-lg text-gray-700">No children linked yet</p>
          <p className="text-sm text-gray-500 max-w-xs">
            No children are currently linked to your account. Please contact the school
            administration for assistance.
          </p>
        </div>
      )}

      {!isLoading && !isError && children && children.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
          {children.map((child) => (
            <ChildCardItem key={child.studentId} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
