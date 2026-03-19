"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

type TeacherRow = {
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
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: number | string | null;
  class_teacher: boolean | null;
};

type SubjectOption = {
  id: number;
  subject_name: string;
};

type SchoolOption = {
  id: string;
  name: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function percentage(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function statusClasses(status: TeacherStatus) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "on_leave":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "retired":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "terminated":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F9E2] text-[#007146]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 12h.01" />
          <path d="M16 12h.01" />
          <path d="M8 12h.01" />
          <path d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4-.8L3 20l1.2-3.2A7.67 7.67 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">No teachers found</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classTeacherFilter, setClassTeacherFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const subjectMap = useMemo(() => {
    return new Map(subjects.map((subject) => [String(subject.id), subject.subject_name]));
  }, [subjects]);

  const schoolMap = useMemo(() => {
    return new Map(schools.map((school) => [school.id, school.name]));
  }, [schools]);

  const fetchPageData = useCallback(async () => {
    setLoading(true);

    const [teachersRes, schoolsRes, subjectsRes] = await Promise.all([
      supabase
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
        .order("created_at", { ascending: false }),
      supabase.from("schools").select("id, name").order("name", { ascending: true }),
      supabase.from("subjects").select("id, subject_name").order("subject_name", { ascending: true }),
    ]);

    if (teachersRes.error) {
      console.error("Teachers fetch failed:", {
        message: teachersRes.error.message,
        details: teachersRes.error.details,
        hint: teachersRes.error.hint,
        code: teachersRes.error.code,
      });
    } else {
      setTeachers((teachersRes.data as TeacherRow[]) ?? []);
    }

    if (schoolsRes.error) {
      console.error("Schools fetch failed:", schoolsRes.error);
    } else {
      setSchools((schoolsRes.data as SchoolOption[]) ?? []);
    }

    if (subjectsRes.error) {
      console.error("Subjects fetch failed:", subjectsRes.error);
    } else {
      setSubjects((subjectsRes.data as SubjectOption[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPageData();
  }, [fetchPageData]);

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let data = teachers.filter((teacher) => {
      const teacherName = (teacher.name ?? "").toLowerCase();
      const email = (teacher.email ?? "").toLowerCase();
      const admission = (teacher.admission_number ?? "").toLowerCase();
      const phone = (teacher.phone ?? "").toLowerCase();
      const school = (schoolMap.get(teacher.school_id) ?? "").toLowerCase();
      const subject = teacher.subject_id
        ? (subjectMap.get(String(teacher.subject_id)) ?? "").toLowerCase()
        : "";

      const matchesSearch =
        !q ||
        teacherName.includes(q) ||
        email.includes(q) ||
        admission.includes(q) ||
        phone.includes(q) ||
        school.includes(q) ||
        subject.includes(q);

      const matchesSchool =
        schoolFilter === "all" || teacher.school_id === schoolFilter;

      const matchesSubject =
        subjectFilter === "all" || String(teacher.subject_id ?? "") === subjectFilter;

      const matchesStatus =
        statusFilter === "all" || teacher.status === statusFilter;

      const matchesClassTeacher =
        classTeacherFilter === "all" ||
        (classTeacherFilter === "yes" && teacher.class_teacher) ||
        (classTeacherFilter === "no" && !teacher.class_teacher);

      return (
        matchesSearch &&
        matchesSchool &&
        matchesSubject &&
        matchesStatus &&
        matchesClassTeacher
      );
    });

    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "admission-asc":
          return a.admission_number.localeCompare(b.admission_number);
        case "admission-desc":
          return b.admission_number.localeCompare(a.admission_number);
        case "attendance-high":
          return percentage(b.attendance_percentage) - percentage(a.attendance_percentage);
        case "attendance-low":
          return percentage(a.attendance_percentage) - percentage(b.attendance_percentage);
        case "newest":
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        case "oldest":
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        default:
          return 0;
      }
    });

    return data;
  }, [
    teachers,
    search,
    schoolFilter,
    subjectFilter,
    statusFilter,
    classTeacherFilter,
    sortBy,
    schoolMap,
    subjectMap,
  ]);

  const totalEntries = filteredTeachers.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [
    search,
    schoolFilter,
    subjectFilter,
    statusFilter,
    classTeacherFilter,
    sortBy,
    pageSize,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTeachers.slice(start, start + pageSize);
  }, [filteredTeachers, page, pageSize]);

  const pageStart = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalEntries);

  async function handleFreeze(teacher: TeacherRow) {
    const nextStatus: TeacherStatus =
      teacher.status === "suspended" ? "active" : "suspended";

    setBusyId(teacher.id);

    const { error } = await supabase
      .from("teachers")
      .update({ status: nextStatus })
      .eq("id", teacher.id);

    if (error) {
      console.error("Teacher freeze toggle failed:", error);
      alert("Failed to update teacher status.");
    } else {
      setTeachers((prev) =>
        prev.map((item) =>
          item.id === teacher.id ? { ...item, status: nextStatus } : item,
        ),
      );
    }

    setBusyId(null);
  }

  async function handleDelete(teacherId: string) {
    const ok = window.confirm("Delete this teacher? This cannot be undone.");
    if (!ok) return;

    setBusyId(teacherId);

    const { error } = await supabase.from("teachers").delete().eq("id", teacherId);

    if (error) {
      console.error("Teacher delete failed:", error);
      alert("Failed to delete teacher.");
    } else {
      setTeachers((prev) => prev.filter((item) => item.id !== teacherId));
    }

    setBusyId(null);
  }

  function renderPagination() {
    if (totalPages <= 1) {
      return (
        <div className="flex items-center gap-2">
          <button className="min-w-[42px] rounded-xl border border-[#F19F24] bg-[#F19F24] px-4 py-2 text-sm font-medium text-white">
            1
          </button>
        </div>
      );
    }

    const items: (number | "...")[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i += 1) items.push(i);
    } else {
      items.push(1);

      if (page > 3) items.push("...");

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i += 1) items.push(i);

      if (page < totalPages - 2) items.push("...");

      items.push(totalPages);
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>

        {items.map((item, index) =>
          item === "..." ? (
            <span key={`dots-${index}`} className="px-1 text-sm text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={item}
              onClick={() => setPage(item)}
              className={`min-w-[42px] rounded-xl border px-4 py-2 text-sm font-medium transition ${
                page === item
                  ? "border-[#F19F24] bg-[#F19F24] text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page === totalPages}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent pl-5 pr-5 pb-6">
      <div className="w-full rounded-none p-5 -mb-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
              Teachers
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Teacher register, filtering, quick actions, and direct access to
              teacher details, timetable, and pupils.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-[16px] border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition ${
                  viewMode === "grid"
                    ? "bg-[#F7F9E2] text-[#007146]"
                    : "text-gray-500 hover:text-[#F19F24]"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Grid
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition ${
                  viewMode === "list"
                    ? "bg-[#F7F9E2] text-[#007146]"
                    : "text-gray-500 hover:text-[#F19F24]"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                List
              </button>
            </div>

            <Link
              href="/dashboard/teachers/new"
              className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-[#d88915]"
            >
                <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14m-7-7h14" />
              </svg>
              Add Teacher
            </Link>
          </div>
        </div>

        <div className="mb-5 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Search
              </label>
              <div className="flex items-center rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, admission, school or subject"
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-700 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                School
              </label>
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All schools</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={String(subject.id)}>
                    {subject.subject_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="on_leave">On Leave</option>
                <option value="retired">Retired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="admission-asc">Admission A–Z</option>
                <option value="admission-desc">Admission Z–A</option>
                <option value="attendance-high">Attendance high</option>
                <option value="attendance-low">Attendance low</option>
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
              </select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Class Teacher
              </label>
              <select
                value={classTeacherFilter}
                onChange={(e) => setClassTeacherFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All</option>
                <option value="yes">Class teachers only</option>
                <option value="no">Non class teachers</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        {loading ? (
          <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
            <p className="mt-4 text-sm text-gray-500">Loading teachers...</p>
          </div>
        ) : totalEntries === 0 ? (
          <EmptyState message="Your current filters returned no teacher records." />
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#F8F8F8] text-left">
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4">Teacher</th>
                    <th className="px-5 py-4">Admission</th>
                    <th className="px-5 py-4">School</th>
                    <th className="px-5 py-4">Subject</th>
                    <th className="px-5 py-4">Contact</th>
                    <th className="px-5 py-4">Attendance</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedTeachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className="border-t border-gray-100 text-sm text-gray-700 hover:bg-[#fffdf6]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {teacher.profile_photo ? (
                            <Image
                              src={teacher.profile_photo}
                              alt={teacher.name}
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-full object-cover ring-2 ring-[#F7F9E2]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F9E2] text-sm font-semibold text-[#007146] ring-2 ring-[#F7F9E2]">
                              {getInitials(teacher.name)}
                            </div>
                          )}

                          <div>
                            <Link
                              href={`/dashboard/teachers/${teacher.id}`}
                              className="font-semibold text-gray-900 transition hover:text-[#F19F24]"
                            >
                              {teacher.name}
                            </Link>
                            <div className="text-xs text-gray-500">{teacher.email}</div>
                            {teacher.class_teacher ? (
                              <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                                Class Teacher
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {teacher.admission_number}
                      </td>

                      <td className="px-5 py-4">
                        {schoolMap.get(teacher.school_id) ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {teacher.subject_id
                          ? (subjectMap.get(String(teacher.subject_id)) ?? "—")
                          : "—"}
                      </td>

                      <td className="px-5 py-4">{teacher.phone || "—"}</td>

                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">
                          {percentage(teacher.attendance_percentage)}%
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(
                            teacher.status,
                          )}`}
                        >
                          {teacher.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleFreeze(teacher)}
                            disabled={busyId === teacher.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            title={
                              teacher.status === "suspended" ? "Unsuspend" : "Suspend"
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
                              <path d="M8 7V5a4 4 0 1 1 8 0v2" />
                              <path d="M12 11v4" />
                            </svg>
                          </button>

                          <Link
                            href={`/dashboard/teachers/${teacher.id}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146] transition hover:scale-[1.02]"
                            title="View details"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Link>

                          <Link
                            href={`/dashboard/teachers/${teacher.id}/students`}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                            title="View pupils"
                          >
                            Pupils
                          </Link>

                          <Link
                            href={`/dashboard/teachers/${teacher.id}/timetable`}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24]"
                            title="View timetable"
                          >
                            Timetable
                          </Link>

                          <Link
                            href={`/dashboard/teachers/${teacher.id}/edit`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-[#F19F24] hover:text-[#F19F24]"
                            title="Edit"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDelete(teacher.id)}
                            disabled={busyId === teacher.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            title="Delete"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {paginatedTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm transition hover:translate-y-[-2px] hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {teacher.profile_photo ? (
                      <Image
                        src={teacher.profile_photo}
                        alt={teacher.name}
                        width={54}
                        height={54}
                        className="h-[54px] w-[54px] rounded-full object-cover ring-2 ring-[#F7F9E2]"
                      />
                    ) : (
                      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#F7F9E2] text-base font-semibold text-[#007146]">
                        {getInitials(teacher.name)}
                      </div>
                    )}

                    <div>
                      <Link
                        href={`/dashboard/teachers/${teacher.id}`}
                        className="text-base font-semibold text-gray-900 transition hover:text-[#F19F24]"
                      >
                        {teacher.name}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">
                        {teacher.admission_number}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(
                      teacher.status,
                    )}`}
                  >
                    {teacher.status.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">School</p>
                    <p className="mt-1 font-medium text-gray-800">
                      {schoolMap.get(teacher.school_id) ?? "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Subject</p>
                    <p className="mt-1 font-medium text-gray-800">
                      {teacher.subject_id
                        ? (subjectMap.get(String(teacher.subject_id)) ?? "—")
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Phone</p>
                    <p className="mt-1 font-medium text-gray-800">{teacher.phone || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Attendance
                    </p>
                    <p className="mt-1 font-medium text-gray-800">
                      {percentage(teacher.attendance_percentage)}%
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Added
                    </p>
                    <p className="mt-1 font-medium text-gray-800">
                      {formatDate(teacher.created_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Class Teacher
                    </p>
                    <p className="mt-1 font-medium text-gray-800">
                      {teacher.class_teacher ? "Yes" : "No"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleFreeze(teacher)}
                    disabled={busyId === teacher.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    title={teacher.status === "suspended" ? "Unsuspend" : "Suspend"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
                      <path d="M8 7V5a4 4 0 1 1 8 0v2" />
                      <path d="M12 11v4" />
                    </svg>
                  </button>

                  <Link
                    href={`/dashboard/teachers/${teacher.id}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]"
                    title="View details"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </Link>

                  <Link
                    href={`/dashboard/teachers/${teacher.id}/students`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700"
                  >
                    Pupils
                  </Link>

                  <Link
                    href={`/dashboard/teachers/${teacher.id}/timetable`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24]"
                  >
                    Timetable
                  </Link>

                  <Link
                    href={`/dashboard/teachers/${teacher.id}/edit`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-[#F19F24] hover:text-[#F19F24]"
                    title="Edit"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDelete(teacher.id)}
                    disabled={busyId === teacher.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    title="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4 rounded-[24px] border border-gray-100 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{pageStart}</span> to{" "}
            <span className="font-semibold text-gray-900">{pageEnd}</span> of{" "}
            <span className="font-semibold text-gray-900">{totalEntries}</span> entries
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>

            {renderPagination()}
          </div>
        </div>
      </div>
    </div>
  );
}