"use client";

import { Blocks, BookOpenText, GraduationCap } from "lucide-react";
import StatCard from "@/components/cards/card";
import { useTeacherPortal } from "@/hooks/useTeacherPortal";

export default function TeacherDashboardPage() {
  const { data, isLoading, isError, error } = useTeacherPortal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#108548] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load dashboard data."}
        </p>
      </div>
    );
  }

  const { teacher, classes, subjects, studentCount } = data!;

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div>
        <h1 className="font-bold text-[22px] mt-[10px]">Teacher Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {teacher.name}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={<Blocks className="h-5 w-5" strokeWidth={1.75} />}
          value={String(classes.length)}
          label="My Classes"
          delta="Active"
          iconBg="bg-green-100"
          iconColor="text-[#108548]"
          deltaStatus="positive"
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" strokeWidth={1.75} />}
          value={String(studentCount)}
          label="My Students"
          delta="Assigned"
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          deltaStatus="neutral"
        />
        <StatCard
          icon={<BookOpenText className="h-5 w-5" strokeWidth={1.75} />}
          value={String(subjects.length)}
          label="My Subjects"
          delta="Teaching"
          iconBg="bg-yellow-100"
          iconColor="text-[#ffc300]"
          deltaStatus="neutral"
        />
      </div>

      {/* My Classes */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-semibold mb-4">My Classes</h2>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-400">No classes assigned yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Class</th>
                  <th className="pb-3 pr-4 font-medium">Stream</th>
                  <th className="pb-3 font-medium">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium">{cls.name}</td>
                    <td className="py-3 pr-4 text-gray-500">
                      {cls.stream ?? "—"}
                    </td>
                    <td className="py-3 text-gray-700">
                      {cls.totalStudents ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Subjects */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-semibold mb-4">My Subjects</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-400">No subjects assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((sub) => (
              <span
                key={sub.id}
                className="rounded-full bg-[#F7F9E2] px-4 py-1.5 text-xs font-medium text-[#F19F24] outline outline-1 outline-yellow-200"
              >
                {sub.subjectName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
