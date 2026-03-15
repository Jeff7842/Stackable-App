"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type StudentRow = {
  id: string;
  user_id: string;
  school_id: string;
  school_name: string;
  admission_no: string;
  class_id: string | null;
  date_of_birth: string | null;
  phone: string | null;
  phone2: string | null;
  profile_picture: string | null;
  status: "active" | "suspended" | "pending" | "removed" | "graduated";
  created_at: string;
  first_name: string | null;
  last_name: string | null;
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

function getStudentName(student: StudentRow) {
  const first = student.first_name?.trim() ?? "";
  const last = student.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || "Unnamed student";
}

function getInitials(student: StudentRow) {
  const name = getStudentName(student);
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "ST";
  return `${parts[0][0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function formatClassLabel(classId: string | null) {
  if (!classId) return "Unassigned";
  // TODO: Replace this with a real join to your classes table.
  return classId.length > 14 ? `Class • ${classId.slice(0, 8)}` : classId;
}

function statusClasses(status: StudentRow["status"]) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "graduated":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "removed":
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">No students found</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const fetchPageData = useCallback(async () => {
    setLoading(true);

    const [studentsRes, schoolsRes] = await Promise.all([
      supabase
        .from("students")
        .select(`
          id,
          user_id,
          school_id,
          school_name,
          admission_no,
          class_id,
          date_of_birth,
          phone,
          phone2,
          profile_picture,
          status,
          created_at,
          first_name,
          last_name
        `)
        .order("created_at", { ascending: false }),
      supabase.from("schools").select("id, name").order("name", { ascending: true }),
    ]);

    if (studentsRes.error) {
      console.error("Students fetch failed:", studentsRes.error);
    } else {
      setStudents((studentsRes.data as StudentRow[]) ?? []);
    }

    if (schoolsRes.error) {
      console.error("Schools fetch failed:", schoolsRes.error);
    } else {
      setSchools((schoolsRes.data as SchoolOption[]) ?? []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPageData();
  }, [fetchPageData]);

  const classOptions = useMemo(() => {
    const unique = Array.from(
      new Set(students.map((item) => item.class_id).filter(Boolean) as string[]),
    );
    return unique.sort((a, b) => a.localeCompare(b));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    let data = students.filter((student) => {
      const studentName = getStudentName(student).toLowerCase();
      const admission = student.admission_no.toLowerCase();
      const school = (student.school_name ?? "").toLowerCase();
      const phoneA = (student.phone ?? "").toLowerCase();
      const phoneB = (student.phone2 ?? "").toLowerCase();
      const classText = (student.class_id ?? "").toLowerCase();

      const matchesSearch =
        !q ||
        studentName.includes(q) ||
        admission.includes(q) ||
        school.includes(q) ||
        phoneA.includes(q) ||
        phoneB.includes(q) ||
        classText.includes(q);

      const matchesSchool =
        schoolFilter === "all" || student.school_id === schoolFilter;

      const matchesClass =
        classFilter === "all" || student.class_id === classFilter;

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesSchool && matchesClass && matchesStatus;
    });

    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return getStudentName(a).localeCompare(getStudentName(b));
        case "name-desc":
          return getStudentName(b).localeCompare(getStudentName(a));
        case "admission-asc":
          return a.admission_no.localeCompare(b.admission_no);
        case "admission-desc":
          return b.admission_no.localeCompare(a.admission_no);
        case "dob-asc":
          return (a.date_of_birth ?? "").localeCompare(b.date_of_birth ?? "");
        case "dob-desc":
          return (b.date_of_birth ?? "").localeCompare(a.date_of_birth ?? "");
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        default:
          return 0;
      }
    });

    return data;
  }, [students, search, schoolFilter, classFilter, statusFilter, sortBy]);

  const totalEntries = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, schoolFilter, classFilter, statusFilter, sortBy, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page, pageSize]);

  const pageStart = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalEntries);

  async function handleFreeze(student: StudentRow) {
    const nextStatus = student.status === "suspended" ? "active" : "suspended";
    setBusyId(student.id);

    const { error } = await supabase
      .from("students")
      .update({ status: nextStatus })
      .eq("id", student.id);

    if (error) {
      console.error("Freeze toggle failed:", error);
      alert("Failed to update student status.");
    } else {
      setStudents((prev) =>
        prev.map((item) =>
          item.id === student.id ? { ...item, status: nextStatus } : item,
        ),
      );
    }

    setBusyId(null);
  }

  async function handleDelete(studentId: string) {
    const ok = window.confirm("Delete this student? This cannot be undone.");
    if (!ok) return;

    setBusyId(studentId);

    const { error } = await supabase.from("students").delete().eq("id", studentId);

    if (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete student.");
    } else {
      setStudents((prev) => prev.filter((item) => item.id !== studentId));
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

      for (let i = start; i <= end; i += 1) {
        items.push(i);
      }

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
      <div className="rounded-none p-5 w-full -mb-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
              Students
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Student register, quick actions, filtering, and direct access to
              each student detail page.
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
              href="/dashboard/students/new"
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
              Add Student
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, admission, school or contact"
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
                Class
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All classes</option>
                {classOptions.map((classId) => (
                  <option key={classId} value={classId}>
                    {formatClassLabel(classId)}
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
                <option value="pending">Pending</option>
                <option value="removed">Removed</option>
                <option value="graduated">Graduated</option>
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
                <option value="dob-asc">DOB oldest</option>
                <option value="dob-desc">DOB newest</option>
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
              </select>
            </div>
          </div>
        </div>
        </div>

        <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)] ">

        {loading ? (
          <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
            <p className="mt-4 text-sm text-gray-500">Loading students...</p>
          </div>
        ) : totalEntries === 0 ? (
          <EmptyState message="Your current filters returned no records." />
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#F8F8F8] text-left">
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Admission</th>
                    <th className="px-5 py-4">School</th>
                    <th className="px-5 py-4">Class</th>
                    <th className="px-5 py-4">Parent Contact</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Date of Birth</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-t border-gray-100 text-sm text-gray-700 hover:bg-[#fffdf6]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {student.profile_picture ? (
                            <Image
                              src={student.profile_picture}
                              alt={getStudentName(student)}
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-full object-cover ring-2 ring-[#F7F9E2]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F9E2] text-sm font-semibold text-[#007146] ring-2 ring-[#F7F9E2]">
                              {getInitials(student)}
                            </div>
                          )}
                          <div>
                            <Link
                              href={`/dashboard/students/${student.id}`}
                              className="font-semibold text-gray-900 transition hover:text-[#F19F24]"
                            >
                              {getStudentName(student)}
                            </Link>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-medium text-gray-900">
                        {student.admission_no}
                      </td>

                      <td className="px-5 py-4">{student.school_name}</td>

                      <td className="px-5 py-4">{formatClassLabel(student.class_id)}</td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">
                            {student.phone || "—"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {student.phone2 || "—"}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(
                            student.status,
                          )}`}
                        >
                          {student.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">{formatDate(student.date_of_birth)}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleFreeze(student)}
                            disabled={busyId === student.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            title={student.status === "suspended" ? "Unfreeze" : "Suspend"}
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
                            href={`/dashboard/students/${student.id}`}
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
                            href={`/dashboard/students/${student.id}/edit`}
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
                            onClick={() => handleDelete(student.id)}
                            disabled={busyId === student.id}
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
            {paginatedStudents.map((student) => (
              <div
                key={student.id}
                className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm transition hover:translate-y-[-2px] hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {student.profile_picture ? (
                      <Image
                        src={student.profile_picture}
                        alt={getStudentName(student)}
                        width={54}
                        height={54}
                        className="h-[54px] w-[54px] rounded-full object-cover ring-2 ring-[#F7F9E2]"
                      />
                    ) : (
                      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#F7F9E2] text-base font-semibold text-[#007146]">
                        {getInitials(student)}
                      </div>
                    )}

                    <div>
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="text-base font-semibold text-gray-900 transition hover:text-[#F19F24]"
                      >
                        {getStudentName(student)}
                      </Link>
                      <p className="mt-1 text-xs text-gray-500">{student.admission_no}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(
                      student.status,
                    )}`}
                  >
                    {student.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">School</p>
                    <p className="mt-1 font-medium text-gray-800">{student.school_name}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Class</p>
                    <p className="mt-1 font-medium text-gray-800">
                      {formatClassLabel(student.class_id)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Parent Contact 1
                    </p>
                    <p className="mt-1 font-medium text-gray-800">{student.phone || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Parent Contact 2
                    </p>
                    <p className="mt-1 font-medium text-gray-800">{student.phone2 || "—"}</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs uppercase tracking-wide text-gray-400">
                      Date of Birth
                    </p>
                    <p className="mt-1 font-medium text-gray-800">
                      {formatDate(student.date_of_birth)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleFreeze(student)}
                    disabled={busyId === student.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    title={student.status === "suspended" ? "Unfreeze" : "Suspend"}
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
                    href={`/dashboard/students/${student.id}`}
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
                    href={`/dashboard/students/${student.id}/edit`}
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
                    onClick={() => handleDelete(student.id)}
                    disabled={busyId === student.id}
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