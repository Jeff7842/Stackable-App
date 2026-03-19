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

type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  admission_number: string;
  profile_photo: string | null;
  class_teacher: boolean;
};

type TimetableRow = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at?: string | null;
};

type ClassRow = {
  id: string;
  class_name: string;
  stream: string | null;
};

type SubjectRow = {
  id: string;
  subject_name: string;
};

function teacherInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function formatClassName(classItem: ClassRow | null | undefined) {
  if (!classItem) return "—";
  return classItem.stream
    ? `${classItem.class_name} ${classItem.stream}`
    : classItem.class_name;
}

function formatDay(day: string) {
  if (!day) return "—";
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

function sortDays(rows: TimetableRow[]) {
  const order = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return [...rows].sort((a, b) => {
    const dayDiff = order.indexOf(a.day_of_week.toLowerCase()) - order.indexOf(b.day_of_week.toLowerCase());
    if (dayDiff !== 0) return dayDiff;
    return a.start_time.localeCompare(b.start_time);
  });
}

export default function TeacherTimetablePage() {
  const params = useParams();
  const id = params?.id as string;

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
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
        .select("id, name, email, phone, admission_number, profile_photo, class_teacher")
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

      setTeacher(teacherRes.data as Teacher);

      const [timetableRes, classesRes, subjectsRes] = await Promise.all([
        supabase
          .from("teacher_timetables")
          .select(`
            id,
            teacher_id,
            class_id,
            subject_id,
            day_of_week,
            start_time,
            end_time,
            room,
            created_at
          `)
          .eq("teacher_id", id),
        supabase
          .from("classes")
          .select("id, class_name, stream"),
        supabase
          .from("subjects")
          .select("id, subject_name"),
      ]);

      if (timetableRes.error) {
        console.error("Timetable fetch failed:", {
          message: timetableRes.error.message,
          details: timetableRes.error.details,
          hint: timetableRes.error.hint,
          code: timetableRes.error.code,
        });
      } else {
        setTimetable((timetableRes.data as TimetableRow[]) ?? []);
      }

      if (classesRes.error) {
        console.error("Classes fetch failed:", classesRes.error);
      } else {
        setClasses((classesRes.data as ClassRow[]) ?? []);
      }

      if (subjectsRes.error) {
        console.error("Subjects fetch failed:", subjectsRes.error);
      } else {
        setSubjects((subjectsRes.data as SubjectRow[]) ?? []);
      }

      setLoading(false);
    }

    void fetchData();
  }, [id]);

  const classMap = useMemo(
    () => new Map(classes.map((item) => [item.id, item])),
    [classes],
  );

  const subjectMap = useMemo(
    () => new Map(subjects.map((item) => [item.id, item.subject_name])),
    [subjects],
  );

  const sortedTimetable = useMemo(() => sortDays(timetable), [timetable]);

  const groupedTimetable = useMemo(() => {
    const groups: Record<string, TimetableRow[]> = {};

    for (const row of sortedTimetable) {
      const key = row.day_of_week.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    return groups;
  }, [sortedTimetable]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading teacher timetable...</p>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-gray-900">Teacher not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {teacher.profile_photo ? (
              <Image
                src={teacher.profile_photo}
                alt={teacher.name}
                width={88}
                height={88}
                className="h-[88px] w-[88px] rounded-full object-cover ring-4 ring-[#F7F9E2]"
              />
            ) : (
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[#F7F9E2] text-2xl font-bold text-[#007146]">
                {teacherInitials(teacher.name)}
              </div>
            )}

            <div>
              <h1 className="text-[26px] font-bold text-gray-900">{teacher.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{teacher.email}</p>
              <p className="mt-1 text-sm text-gray-500">{teacher.phone || "—"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  {teacher.admission_number}
                </span>
                {teacher.class_teacher && (
                  <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    Class Teacher
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/teachers/${teacher.id}`}
              className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
            >
              Back to Teacher
            </Link>

            <Link
              href={`/dashboard/teachers/${teacher.id}/students`}
              className="rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white hover:bg-[#d88915]"
            >
              View Students
            </Link>
          </div>
        </div>

        <div className="mt-[30px] rounded-[24px] border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Teacher Timetable</h3>
            <p className="mt-1 text-sm text-gray-500">
              Total timetable entries: {sortedTimetable.length}
            </p>
          </div>

          {sortedTimetable.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              No timetable entries are currently linked to this teacher.
            </div>
          ) : (
            <div className="space-y-6 p-5">
              {Object.entries(groupedTimetable).map(([day, rows]) => (
                <div
                  key={day}
                  className="overflow-hidden rounded-[20px] border border-gray-100"
                >
                  <div className="border-b border-gray-100 bg-[#F8F8F8] px-4 py-3">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                      {formatDay(day)}
                    </h4>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-white text-left">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">Class</th>
                          <th className="px-4 py-3">Subject</th>
                          <th className="px-4 py-3">Room</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-gray-100 text-sm text-gray-700"
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {row.start_time} - {row.end_time}
                            </td>
                            <td className="px-4 py-3">
                              {formatClassName(
                                row.class_id ? classMap.get(row.class_id) : null,
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {row.subject_id ? subjectMap.get(row.subject_id) ?? "—" : "—"}
                            </td>
                            <td className="px-4 py-3">{row.room || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}