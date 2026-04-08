"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  GraduationCap,
  IdCard,
  Mail,
  PencilLine,
  Phone,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import { numericScore } from "@/lib/teachers";

type TeacherSubject = {
  id: number;
  subject_name: string;
};

type TeacherClass = {
  id: string;
  label: string;
};

type TeacherDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  admission_number: string;
  profile_photo: string | null;
  status: string;
  class_teacher: boolean | null;
  school_name: string | null;
  attendance_percentage: number | string | null;
  days_present: number | null;
  total_school_days: number | null;
  subjects: TeacherSubject[];
  classes: TeacherClass[];
  students_count: number;
};

type StudentPerformanceRow = {
  id: string;
  full_name: string;
  admission_no: string;
  class_name: string;
  phone: string | null;
  phone2: string | null;
  status: string;
  profile_picture: string | null;
  avg_score: number | null;
  grade: string;
};

type ApiPayload = {
  teacher: TeacherDetail;
  students: StudentPerformanceRow[];
};

function teacherInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function studentInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ST";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function percentage(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function statusPill(status: string) {
  switch (status) {
    case "active":
      return "border-green-200 bg-green-50 text-green-700";
    case "suspended":
      return "border-red-200 bg-red-50 text-red-700";
    case "on_leave":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "retired":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "terminated":
      return "border-gray-200 bg-gray-100 text-gray-700";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

function studentStatusPill(status: string) {
  switch (status) {
    case "active":
      return "border-green-200 bg-green-50 text-green-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "suspended":
      return "border-red-200 bg-red-50 text-red-700";
    case "graduated":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "removed":
      return "border-gray-200 bg-gray-100 text-gray-700";
    default:
      return "border-gray-200 bg-gray-100 text-gray-700";
  }
}

export default function TeacherSlugPage() {
  const params = useParams();
  const teacherId = params?.id as string;

  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTeacherDetails() {
      if (!teacherId) {
        setError("Teacher id is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/teachers/${teacherId}`, {
          cache: "no-store",
        });
        const response = (await res.json()) as {
          error?: string;
          data?: ApiPayload;
        };

        if (!res.ok || !response.data) {
          throw new Error(response.error || "Failed to load teacher details.");
        }

        setPayload(response.data);
      } catch (fetchError) {
        console.error(fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load teacher details.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchTeacherDetails();
  }, [teacherId]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading teacher profile...</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-gray-900">Teacher not found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {error || "The requested teacher record could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  const { teacher, students } = payload;
  const trackedScores = students
    .map((student) => numericScore(student.avg_score))
    .filter((score): score is number => score !== null);
  const averagePerformance = trackedScores.length
    ? trackedScores.reduce((total, score) => total + score, 0) / trackedScores.length
    : null;

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/teachers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#007146] transition hover:text-[#F19F24]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to teachers
          </Link>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight text-gray-900">
            Teacher Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View the teacher&apos;s information together with every student linked to
            the class they teach and each learner&apos;s current performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/teachers/${teacher.id}/edit`}
            className="inline-flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24]"
          >
            <PencilLine className="h-4 w-4" />
            Edit Teacher
          </Link>

          <Link
            href={`/dashboard/teachers/${teacher.id}/timetable`}
            className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d88915]"
          >
            <CalendarClock className="h-4 w-4" />
            Teacher Timetable
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {teacher.profile_photo ? (
              <Image
                src={teacher.profile_photo}
                alt={teacher.name}
                width={120}
                height={120}
                className="h-[120px] w-[120px] rounded-full object-cover ring-4 ring-[#F7F9E2]"
              />
            ) : (
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[#F7F9E2] text-3xl font-bold text-[#007146]">
                {teacherInitials(teacher.name)}
              </div>
            )}

            <h2 className="mt-4 text-2xl font-bold text-gray-900">{teacher.name}</h2>

            <span
              className={`mt-3 inline-flex rounded-full border px-4 py-2 text-sm font-semibold capitalize ${statusPill(
                teacher.status,
              )}`}
            >
              {teacher.status.replace("_", " ")}
            </span>

            <div className="mt-6 w-full space-y-3 text-left">
              {[
                {
                  icon: IdCard,
                  label: "Teacher ID",
                  value: teacher.admission_number,
                },
                {
                  icon: Mail,
                  label: "Email",
                  value: teacher.email || "Not provided",
                },
                {
                  icon: Phone,
                  label: "Phone",
                  value: teacher.phone || "Not provided",
                },
                {
                  icon: School,
                  label: "School",
                  value: teacher.school_name || "Not set",
                },
                {
                  icon: GraduationCap,
                  label: "Assigned Classes",
                  value:
                    teacher.classes.length > 0
                      ? teacher.classes.map((classItem) => classItem.label).join(", ")
                      : "No class assigned",
                },
                {
                  icon: BookOpen,
                  label: "Subjects",
                  value:
                    teacher.subjects.length > 0
                      ? teacher.subjects
                          .map((subject) => subject.subject_name)
                          .join(", ")
                      : "No subject assigned",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-gray-100 bg-[#FCFCFC] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F9E2] text-[#007146]">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Users,
                label: "Students Taught",
                value: String(teacher.students_count),
              },
              {
                icon: Sparkles,
                label: "Average Performance",
                value:
                  averagePerformance != null
                    ? averagePerformance.toFixed(2)
                    : "No scores yet",
              },
              {
                icon: School,
                label: "Attendance",
                value: `${percentage(teacher.attendance_percentage)}%`,
              },
              {
                icon: GraduationCap,
                label: "Class Teacher",
                value: teacher.class_teacher ? "Yes" : "No",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E2] text-[#F19F24]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F9E2] text-[#007146]">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Students Taught By This Teacher
                </h2>
                <p className="text-sm text-gray-500">
                  Performance for each student is shown using the available
                  student average grade data.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#F8F8F8] text-left">
                    <tr className="text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-4">Student</th>
                      <th className="px-5 py-4">Admission</th>
                      <th className="px-5 py-4">Class</th>
                      <th className="px-5 py-4">Contacts</th>
                      <th className="px-5 py-4">Performance</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-gray-500"
                        >
                          No students are linked to this teacher&apos;s assigned class yet.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => (
                        <tr
                          key={student.id}
                          className="border-t border-gray-100 text-sm text-gray-700"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {student.profile_picture ? (
                                <Image
                                  src={student.profile_picture}
                                  alt={student.full_name}
                                  width={42}
                                  height={42}
                                  className="h-10 w-10 rounded-full object-cover ring-2 ring-[#F7F9E2]"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F9E2] text-sm font-semibold text-[#007146] ring-2 ring-[#F7F9E2]">
                                  {studentInitials(student.full_name)}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {student.full_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Learner profile linked through class assignment
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-medium text-gray-900">
                            {student.admission_no}
                          </td>
                          <td className="px-5 py-4">{student.class_name}</td>
                          <td className="px-5 py-4">
                            <p>{student.phone || "Not provided"}</p>
                            <p className="text-xs text-gray-500">
                              {student.phone2 || "No secondary contact"}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full border border-[#dbe8cc] bg-[#F7F9E2] px-3 py-1 text-xs font-semibold text-[#007146]">
                                {student.avg_score != null
                                  ? student.avg_score.toFixed(2)
                                  : "No score"}
                              </span>
                              <span className="rounded-full border border-[#FFE2B8] bg-[#FFF4E2] px-3 py-1 text-xs font-semibold text-[#B76A00]">
                                Grade {student.grade}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${studentStatusPill(
                                student.status,
                              )}`}
                            >
                              {student.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
