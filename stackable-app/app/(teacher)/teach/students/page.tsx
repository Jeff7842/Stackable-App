"use client";

import { useTeacherStudents } from "@/hooks/useTeacherStudents";

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-700 outline outline-1 outline-green-400"
          : "bg-gray-100 text-gray-500 outline outline-1 outline-gray-300"
      }`}
    >
      {status}
    </span>
  );
}

export default function MyStudentsPage() {
  const { data, isLoading, isError, error } = useTeacherStudents();

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
          {error instanceof Error ? error.message : "Failed to load students."}
        </p>
      </div>
    );
  }

  const { students, total } = data!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-[22px] mt-[10px]">My Students</h1>
        <p className="text-sm text-gray-500 mt-1">{total} student{total !== 1 ? "s" : ""} assigned to you</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        {students.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No students assigned yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Student Name</th>
                  <th className="pb-3 pr-4 font-medium">Admission No</th>
                  <th className="pb-3 pr-4 font-medium">Class</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium">
                      {[student.firstName, student.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {student.admissionNo}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {student.className ?? "—"}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={student.status} />
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
