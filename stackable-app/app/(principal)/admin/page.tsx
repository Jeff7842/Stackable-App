"use client";

import Link from "next/link";
import {
  GraduationCap,
  Users,
  BriefcaseBusiness,
  UserCheck,
} from "lucide-react";
import StatCard from "@/components/cards/card";

// TODO: Replace stub values with real API data when the principal stats endpoint is ready.
// Expected shape: { totalStudents: number; totalTeachers: number; totalStaff: number; totalParents: number }
const STUB_STATS = {
  totalStudents: 0,
  totalTeachers: 0,
  totalStaff: 0,
  totalParents: 0,
};

const QUICK_LINKS = [
  { label: "Students", href: "/admin/students" },
  { label: "Teachers", href: "/admin/teachers" },
  { label: "Subjects", href: "/admin/academics" },
  { label: "Classes", href: "/admin/academics" },
  { label: "Payments", href: "/admin/finance" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminOverviewPage() {
  const { totalStudents, totalTeachers, totalStaff, totalParents } = STUB_STATS;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="font-bold text-[22px] mt-[10px]">School Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          A snapshot of your school at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<GraduationCap className="h-5 w-5" strokeWidth={1.75} />}
          value={String(totalStudents)}
          label="Total Students"
          delta="Enrolled"
          iconBg="bg-green-100"
          iconColor="text-[#108548]"
          deltaStatus="positive"
        />
        <StatCard
          icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
          value={String(totalTeachers)}
          label="Teachers"
          delta="Active"
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          deltaStatus="neutral"
        />
        <StatCard
          icon={<BriefcaseBusiness className="h-5 w-5" strokeWidth={1.75} />}
          value={String(totalStaff)}
          label="Staff"
          delta="Active"
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          deltaStatus="neutral"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
          value={String(totalParents)}
          label="Parents"
          delta="Registered"
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          deltaStatus="neutral"
        />
      </div>

      {/* Quick links */}
      <div className="rounded-2xl bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ label, href }) => (
            <Link
              key={href + label}
              href={href}
              className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-[#108548]/10 hover:text-[#108548] transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
