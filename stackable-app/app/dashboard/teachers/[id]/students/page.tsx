"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type TeacherStatus =
  | "active"
  | "suspended"
  | "on_leave"
  | "retired"
  | "terminated";

type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  admission_number: string;
  subject_id: number | null;
  school_id: string;
  profile_photo: string | null;
  status: TeacherStatus;
  created_at: string | null;
  days_present: number;
  total_school_days: number;
  attendance_percentage: number | string | null;
  class_teacher: boolean;
};

type Subject = {
  id: number;
  subject_name: string;
};

type AttendanceRow = {
  id: string;
  user_type: "student" | "teacher" | "staff";
  user_id: string;
  school_id: string;
  school_name: string;
  school_no: number;
  clock_in: string;
  clock_out: string | null;
  status: "present" | "late" | "absent";
  remarks: string | null;
  created_at: string;
  reference_code: string;
};

function percentage(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusPill(status: string) {
  switch (status) {
    case "present":
      return "bg-green-50 text-green-700 border-green-200";
    case "late":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "absent":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function TeacherDetailsPage() {
  const params = useParams();
  const id = params?.id as string;

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        console.error("Teacher id is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);

      const teacherRes = await supabase
        .from("teachers")
        .select(`
          id,
          name,
          email,
          phone,
          admission_number,
          subject_id,
          school_id,
          profile_photo,
          status,
          created_at,
          days_present,
          total_school_days,
          attendance_percentage,
          class_teacher
        `)
        .eq("id", id)
        .maybeSingle();

      if (teacherRes.error) {
        console.error("Teacher fetch failed:", {
          message: teacherRes.error.message,
          details: teacherRes.error.details,
          hint: teacherRes.error.hint,
          code: teacherRes.error.code,
        });
        setLoading(false);
        return;
      }

      if (!teacherRes.data) {
        setTeacher(null);
        setLoading(false);
        return;
      }

      const teacherData = teacherRes.data as Teacher;
      setTeacher(teacherData);

      const [subjectRes, attendanceRes] = await Promise.all([
        teacherData.subject_id
          ? supabase
              .from("subjects")
              .select("id, subject_name")
              .eq("id", teacherData.subject_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("attendance")
          .select(`
            id,
            user_type,
            user_id,
            school_id,
            school_name,
            school_no,
            clock_in,
            clock_out,
            status,
            remarks,
            created_at,
            reference_code
          `)
          .eq("user_type", "teacher")
          .eq("user_id", id)
          .order("clock_in", { ascending: false }),
      ]);

      if (subjectRes?.error) {
        console.error("Subject fetch failed:", {
          message: subjectRes.error.message,
          details: subjectRes.error.details,
          hint: subjectRes.error.hint,
          code: subjectRes.error.code,
        });
      } else {
        setSubject((subjectRes?.data as Subject | null) ?? null);
      }

      if (attendanceRes.error) {
        console.error("Attendance fetch failed:", {
          message: attendanceRes.error.message,
          details: attendanceRes.error.details,
          hint: attendanceRes.error.hint,
          code: attendanceRes.error.code,
        });
      } else {
        setAttendance((attendanceRes.data as AttendanceRow[]) ?? []);
      }

      setLoading(false);
    }

    void fetchData();
  }, [id]);

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((item) => item.status === "present").length;
    const late = attendance.filter((item) => item.status === "late").length;
    const absent = attendance.filter((item) => item.status === "absent").length;

    return { total, present, late, absent };
  }, [attendance]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading teacher details...</p>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-gray-900">Teacher not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The requested teacher record could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const attendancePct = percentage(teacher.attendance_percentage);

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
            Teacher Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Attendance, workload, teaching ownership, and teacher-linked actions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/teachers/${teacher.id}/students`}
            className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
          >
            View Students / Pupils
          </Link>

          <Link
            href={`/dashboard/teachers/${teacher.id}/timetable`}
            className="rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d88915]"
          >
            Teacher Timetable
          </Link>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          <div className="rounded-[24px] border border-gray-100 bg-[#FCFCFC] p-5">
            <div className="flex items-start gap-4">
              {teacher.profile_photo ? (
                <Image
                  src={teacher.profile_photo}
                  alt={teacher.name}
                  width={92}
                  height={92}
                  className="h-[92px] w-[92px] rounded-full object-cover ring-4 ring-[#F7F9E2]"
                />
              ) : (
                <div className="flex h-[92px] w-[92px] items-center justify-center rounded-full bg-[#F7F9E2] text-2xl font-bold text-[#007146]">
                  {initials(teacher.name)}
                </div>
              )}

              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{teacher.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{teacher.email}</p>
                <p className="mt-1 text-sm text-gray-500">{teacher.phone || "—"}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    {teacher.admission_number}
                  </span>

                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {subject?.subject_name ?? "No subject"}
                  </span>

                  {teacher.class_teacher && (
                    <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      Class Teacher
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
                <p className="mt-1 font-semibold capitalize text-gray-900">
                  {teacher.status.replace("_", " ")}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Attendance
                </p>
                <p className="mt-1 font-semibold text-gray-900">{attendancePct}%</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Days Present
                </p>
                <p className="mt-1 font-semibold text-gray-900">{teacher.days_present}</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Total School Days
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {teacher.total_school_days}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <div className="rounded-[20px] border border-gray-100 bg-[#FFFDF8] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Attendance Logs
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {attendanceSummary.total}
                </p>
              </div>

              <div className="rounded-[20px] border border-gray-100 bg-[#FFFDF8] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Present</p>
                <p className="mt-2 text-2xl font-bold text-green-700">
                  {attendanceSummary.present}
                </p>
              </div>

              <div className="rounded-[20px] border border-gray-100 bg-[#FFFDF8] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Late</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">
                  {attendanceSummary.late}
                </p>
              </div>

              <div className="rounded-[20px] border border-gray-100 bg-[#FFFDF8] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Absent</p>
                <p className="mt-2 text-2xl font-bold text-red-700">
                  {attendanceSummary.absent}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Attendance Records
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Detailed teacher attendance history from the attendance table.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#F8F8F8] text-left">
                    <tr className="text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-4">Reference</th>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Clock In</th>
                      <th className="px-5 py-4">Clock Out</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                          No attendance records found for this teacher.
                        </td>
                      </tr>
                    ) : (
                      attendance.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-gray-100 text-sm text-gray-700"
                        >
                          <td className="px-5 py-4 font-medium text-gray-900">
                            {item.reference_code}
                          </td>
                          <td className="px-5 py-4">{formatDateTime(item.clock_in)}</td>
                          <td className="px-5 py-4">{formatTime(item.clock_in)}</td>
                          <td className="px-5 py-4">{formatTime(item.clock_out)}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusPill(
                                item.status,
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">{item.remarks || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">
                Performance Snapshot
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Teaching Role
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {teacher.class_teacher
                      ? "Leads a class as a class teacher"
                      : "Serves as a subject teacher"}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Subject Owned
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {subject?.subject_name ?? "Not assigned"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}