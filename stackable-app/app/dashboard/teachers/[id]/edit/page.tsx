"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  school_id: string;
  profile_photo: string | null;
  class_teacher: boolean;
  status: TeacherStatus;
  subject_id: number | null;
  created_at: string | null;
  days_present: number | null;
  total_school_days: number | null;
  attendance_percentage: number | string | null;
  class_id?: string | null;
};

type Subject = {
  id: number;
  subject_name: string;
};

type ClassRow = {
  id: string;
  class_name: string;
  school_id: string;
  stream: string | null;
  class_teacher_id?: string | null;
};

type TimetableItemType = "class" | "event" | "duty" | "task";

type TimetableRow = {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: number | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  item_type?: TimetableItemType | null;
  title?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type TeacherSubjectRow = {
  teacher_id: string;
  subject_id: number;
};

const STATUS_META: Record<
  TeacherStatus,
  { label: string; active: string; idle: string }
> = {
  active: {
    label: "Active",
    active: "border-green-300 bg-green-50 text-green-700",
    idle: "border-gray-200 bg-gray-50 text-gray-500",
  },
  suspended: {
    label: "Suspended",
    active: "border-red-300 bg-red-50 text-red-700",
    idle: "border-gray-200 bg-gray-50 text-gray-500",
  },
  on_leave: {
    label: "On Leave",
    active: "border-amber-300 bg-amber-50 text-amber-700",
    idle: "border-gray-200 bg-gray-50 text-gray-500",
  },
  retired: {
    label: "Retired",
    active: "border-blue-300 bg-blue-50 text-blue-700",
    idle: "border-gray-200 bg-gray-50 text-gray-500",
  },
  terminated: {
    label: "Terminated",
    active: "border-gray-300 bg-gray-200 text-gray-700",
    idle: "border-gray-200 bg-gray-50 text-gray-500",
  },
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const SLOT_STARTS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TR";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function percent(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function formatClassName(cls: ClassRow | null | undefined) {
  if (!cls) return "—";
  return cls.stream ? `${cls.class_name} ${cls.stream}` : cls.class_name;
}

function labelDay(day: string | null | undefined) {
  const safe = String(day ?? "").trim();
  if (!safe) return "Unknown";
  return safe.charAt(0).toUpperCase() + safe.slice(1).toLowerCase();
}

function timeToMinutes(time: string | null | undefined) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function sortTimetable(rows: TimetableRow[]) {
  return [...rows].sort((a, b) => {
    const dayA = DAYS.indexOf(
      String(a.day_of_week ?? "").toLowerCase() as (typeof DAYS)[number],
    );
    const dayB = DAYS.indexOf(
      String(b.day_of_week ?? "").toLowerCase() as (typeof DAYS)[number],
    );
    const safeA = dayA === -1 ? 999 : dayA;
    const safeB = dayB === -1 ? 999 : dayB;
    if (safeA !== safeB) return safeA - safeB;
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
}

function tileStyle(type: TimetableItemType | null | undefined) {
  switch (type) {
    case "event":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "duty":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "task":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    default:
      return "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]";
  }
}

export default function TeacherEditSlugPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const teacherId = params?.id as string;
  const initialMode = searchParams?.get("mode") === "view" ? "view" : "edit";

  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState<"email" | "phone" | null>(null);

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    admission_number: "",
    school_id: "",
    class_teacher: false,
    status: "active" as TeacherStatus,
    profile_photo: "",
  });

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<number[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [classTeacherForClassId, setClassTeacherForClassId] = useState<string>("");

  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [statusCandidate, setStatusCandidate] = useState<TeacherStatus | null>(null);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableRow | null>(null);
  const [slotForm, setSlotForm] = useState({
    item_type: "class" as TimetableItemType,
    title: "",
    class_id: "",
    subject_id: "",
    day_of_week: "monday",
    start_time: "08:00",
    end_time: "09:00",
    room: "",
    notes: "",
  });

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!teacherId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch teacher first to get school_id for classes query
      const teacherRes = await supabase
        .from("teachers")
        .select(`
          id,
          name,
          email,
          phone,
          admission_number,
          school_id,
          profile_photo,
          class_teacher,
          status,
          subject_id,
          created_at,
          days_present,
          total_school_days,
          attendance_percentage
        `)
        .eq("id", teacherId)
        .maybeSingle();

      if (teacherRes.error) {
        console.error("Teacher fetch failed:", teacherRes.error);
        setLoading(false);
        return;
      }

      if (!teacherRes.data) {
        setTeacher(null);
        setLoading(false);
        return;
      }

      const teacherData = teacherRes.data as Teacher;

      const [subjectsRes, classesRes, timetableRes, teacherSubjectsRes] =
        await Promise.all([
          supabase
            .from("subjects")
            .select("id, subject_name")
            .order("subject_name", { ascending: true }),
          supabase
            .from("classes")
            .select("id, school_id, class_name, stream, class_teacher_id")
            .eq("school_id", teacherData.school_id)
            .order("class_name", { ascending: true }),
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
              item_type,
              title,
              notes,
              created_at
            `)
            .eq("teacher_id", teacherId),
          supabase
            .from("teacher_subjects")
            .select("teacher_id, subject_id")
            .eq("teacher_id", teacherId),
        ]);

      const allowedClassIds = ((classesRes.data as ClassRow[]) ?? [])
  .filter((cls) => cls.class_teacher_id === teacherData.id)
  .map((cls) => cls.id);
      setTeacher(teacherData);
      setForm({
        name: teacherData.name ?? "",
        email: teacherData.email ?? "",
        phone: teacherData.phone ?? "",
        admission_number: teacherData.admission_number ?? "",
        school_id: teacherData.school_id ?? "",
        class_teacher: !!teacherData.class_teacher,
        status: teacherData.status ?? "active",
        profile_photo: teacherData.profile_photo ?? "",
      });

      setSubjects((subjectsRes.data as Subject[]) ?? []);
      const classRows = (classesRes.data as ClassRow[]) ?? [];
      setClasses(classRows);
      setTimetable(sortTimetable((timetableRes.data as TimetableRow[]) ?? []));

      const fromBridge = ((teacherSubjectsRes.data as TeacherSubjectRow[]) ?? []).map(
        (row) => Number(row.subject_id),
      );

      const mergedSubjects = Array.from(
        new Set([
          ...fromBridge,
          ...(teacherData.subject_id ? [Number(teacherData.subject_id)] : []),
        ]),
      ).filter(Boolean);

      setAssignedSubjectIds(mergedSubjects);

      const classTeacherClass = classRows.find(
        (cls) => cls.class_teacher_id === teacherData.id,
      );
      setClassTeacherForClassId(classTeacherClass?.id ?? "");

      const timetableClassIds = ((timetableRes.data as TimetableRow[]) ?? [])
        .map((row) => row.class_id)
        .filter(Boolean) as string[];

      const classTeacherIds = classTeacherClass?.id ? [classTeacherClass.id] : [];

      setAssignedClassIds(Array.from(new Set([...timetableClassIds, ...classTeacherIds])));
      setLoading(false);
    }

    void fetchData();
  }, [teacherId]);

  const subjectMap = useMemo(
    () => new Map(subjects.map((item) => [String(item.id), item.subject_name])),
    [subjects],
  );

  const classMap = useMemo(
    () => new Map(classes.map((item) => [item.id, item])),
    [classes],
  );

  const groupedByDay = useMemo(() => {
    const groups: Record<string, TimetableRow[]> = {};
    for (const day of DAYS) groups[day] = [];
    for (const row of timetable) {
      const key = String(row.day_of_week ?? "").toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      );
    }
    return groups;
  }, [timetable]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSubject(subjectId: number) {
    if (mode === "view") return;
    setAssignedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }

  function toggleAssignedClass(classId: string) {
    if (mode === "view") return;
    setAssignedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  }

  function requestStatusChange(next: TeacherStatus) {
    if (mode === "view") return;
    if (next === form.status) return;
    setStatusCandidate(next);
    setShowStatusConfirm(true);
  }

  function confirmStatusChange() {
    if (!statusCandidate) return;
    updateForm("status", statusCandidate);
    setShowStatusConfirm(false);
    setStatusCandidate(null);
  }

  function cancelStatusChange() {
    setShowStatusConfirm(false);
    setStatusCandidate(null);
  }

  function openNewSlot(day?: string, time?: string) {
    if (mode === "view") return;
    setEditingSlot(null);
    setSlotForm({
      item_type: "class",
      title: "",
      class_id: assignedClassIds[0] ?? "",
      subject_id: assignedSubjectIds[0] ? String(assignedSubjectIds[0]) : "",
      day_of_week: day ?? "monday",
      start_time: time ?? "08:00",
      end_time: "09:00",
      room: "",
      notes: "",
    });
    setShowSlotModal(true);
  }

  function openEditSlot(slot: TimetableRow) {
    if (mode === "view") return;
    setEditingSlot(slot);
    setSlotForm({
      item_type: (slot.item_type ?? "class") as TimetableItemType,
      title: slot.title ?? "",
      class_id: slot.class_id ?? "",
      subject_id: slot.subject_id ? String(slot.subject_id) : "",
      day_of_week: slot.day_of_week ?? "monday",
      start_time: slot.start_time ?? "08:00",
      end_time: slot.end_time ?? "09:00",
      room: slot.room ?? "",
      notes: slot.notes ?? "",
    });
    setShowSlotModal(true);
  }

  function closeSlotModal() {
    setShowSlotModal(false);
    setEditingSlot(null);
  }

  function saveSlotLocal() {
    const row: TimetableRow = {
      id: editingSlot?.id ?? `temp-${Date.now()}`,
      teacher_id: teacherId,
      class_id: slotForm.item_type === "class" ? slotForm.class_id || null : null,
      subject_id:
        slotForm.item_type === "class" && slotForm.subject_id
          ? Number(slotForm.subject_id)
          : null,
      day_of_week: slotForm.day_of_week,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      room: slotForm.room || null,
      item_type: slotForm.item_type,
      title: slotForm.item_type === "class" ? null : slotForm.title,
      notes: slotForm.notes || null,
    };

    setTimetable((prev) => {
      const next = editingSlot
        ? prev.map((item) => (item.id === editingSlot.id ? row : item))
        : [...prev, row];
      return sortTimetable(next);
    });

    if (row.class_id && !assignedClassIds.includes(row.class_id)) {
      setAssignedClassIds((prev) => [...prev, row.class_id!]);
    }

    closeSlotModal();
  }

  function deleteSlotLocal(id: string) {
    if (mode === "view") return;
    const ok = window.confirm("Delete this timetable item?");
    if (!ok) return;
    setTimetable((prev) => prev.filter((item) => item.id !== id));
  }

  function onDragStart(slotId: string) {
    if (mode === "view") return;
    setDraggingId(slotId);
  }

  function onDrop(day: string, startTime: string) {
    if (mode === "view" || !draggingId) return;
    setTimetable((prev) =>
      sortTimetable(
        prev.map((item) =>
          item.id === draggingId
            ? { ...item, day_of_week: day, start_time: startTime }
            : item,
        ),
      ),
    );
    setDraggingId(null);
  }

  async function handlePhotoPicked(file: File) {
    if (!teacherId) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `teachers/${teacherId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("teacher-profile-photos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error("Photo upload failed:", uploadError);
      alert("Failed to upload photo.");
      return;
    }

    const { data } = supabase.storage
      .from("teacher-profile-photos")
      .getPublicUrl(path);

    updateForm("profile_photo", data.publicUrl);
  }

  async function handleVerify(kind: "email" | "phone") {
    setVerifying(kind);
    try {
      const endpoint =
        kind === "email"
          ? `/api/teachers/${teacherId}/send-email-verification`
          : `/api/teachers/${teacherId}/send-phone-verification`;

      const payload =
        kind === "email"
          ? { email: form.email }
          : { phone: form.phone };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Verification request failed: ${res.status}`);
      alert(
        kind === "email"
          ? "Verification email sent."
          : "Verification text sent.",
      );
    } catch (error) {
      console.error(error);
      alert(`Failed to send ${kind} verification.`);
    } finally {
      setVerifying(null);
    }
  }

  async function handleSaveAll() {
    if (!teacherId || !teacher) return;
    setSaving(true);

    try {
      const primarySubjectId = assignedSubjectIds[0] ?? null;

      const teacherUpdate = await supabase
        .from("teachers")
        .update({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          admission_number: form.admission_number,
          school_id: form.school_id,
          profile_photo: form.profile_photo || null,
          class_teacher: form.class_teacher,
          status: form.status,
          subject_id: primarySubjectId,
        })
        .eq("id", teacherId);

      if (teacherUpdate.error) throw teacherUpdate.error;

      const currentClassTeacherClassIds = classes
        .filter((cls) => cls.class_teacher_id === teacherId)
        .map((cls) => cls.id);

      if (currentClassTeacherClassIds.length) {
        const clearRes = await supabase
          .from("classes")
          .update({ class_teacher_id: null })
          .in("id", currentClassTeacherClassIds);
        if (clearRes.error) throw clearRes.error;
      }

      if (form.class_teacher && classTeacherForClassId) {
        const assignRes = await supabase
          .from("classes")
          .update({ class_teacher_id: teacherId })
          .eq("id", classTeacherForClassId);
        if (assignRes.error) throw assignRes.error;
      }

      const bridgeDelete = await supabase
        .from("teacher_subjects")
        .delete()
        .eq("teacher_id", teacherId);

      if (bridgeDelete.error) {
        console.error("Teacher subjects clear failed:", bridgeDelete.error);
      }

      if (assignedSubjectIds.length) {
        const bridgeInsert = await supabase.from("teacher_subjects").insert(
          assignedSubjectIds.map((subjectId) => ({
            teacher_id: teacherId,
            subject_id: subjectId,
          })),
        );
        if (bridgeInsert.error) {
          console.error("Teacher subjects save failed:", bridgeInsert.error);
        }
      }

      const existingRealIds = timetable
        .filter((row) => !String(row.id).startsWith("temp-"))
        .map((row) => row.id);

      if (existingRealIds.length) {
        const deleteOld = await supabase
          .from("teacher_timetables")
          .delete()
          .eq("teacher_id", teacherId);
        if (deleteOld.error) throw deleteOld.error;
      }

      if (timetable.length) {
        const insertRes = await supabase.from("teacher_timetables").insert(
          timetable.map((row) => ({
            teacher_id: teacherId,
            class_id: row.class_id,
            subject_id: row.subject_id,
            day_of_week: row.day_of_week,
            start_time: row.start_time,
            end_time: row.end_time,
            room: row.room,
            item_type: row.item_type ?? "class",
            title: row.title,
            notes: row.notes,
          })),
        );
        if (insertRes.error) throw insertRes.error;
      }

      alert("Teacher profile updated successfully.");
      router.refresh();
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save teacher changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading teacher workspace...</p>
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
            {mode === "edit" ? "Edit Teacher" : "Teacher Details"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Full teacher profile, subject assignment, class ownership, and default timetable operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setMode((prev) => (prev === "edit" ? "view" : "edit"))}
            className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
          >
            {mode === "edit" ? "Switch to View" : "Switch to Edit"}
          </button>

          <Link
            href={`/dashboard/teachers/${teacher.id}/students`}
            className="rounded-[16px] border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700"
          >
            View Pupils
          </Link>

          <Link
            href={`/dashboard/teachers/${teacher.id}/timetable`}
            className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700"
          >
            Timetable Page
          </Link>

          {mode === "edit" && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d88915] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {form.profile_photo ? (
                <Image
                  src={form.profile_photo}
                  alt={form.name}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-[#F7F9E2]"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F7F9E2] text-2xl font-bold text-[#007146]">
                  {initials(form.name || teacher.name)}
                </div>
              )}

              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{form.name || "Unnamed Teacher"}</h2>
                <p className="mt-1 text-sm text-gray-500">{form.email || "No email"}</p>
                <p className="mt-1 text-sm text-gray-500">{form.phone || "No phone"}</p>

                {mode === "edit" && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handlePhotoPicked(file);
                      }}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="mt-3 rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
                    >
                      Change Photo
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Status</p>
                <p className="mt-1 font-semibold capitalize text-gray-900">
                  {form.status.replace("_", " ")}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Attendance</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {percent(teacher.attendance_percentage)}%
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Days Present</p>
                <p className="mt-1 font-semibold text-gray-900">{teacher.days_present ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-[#FCFCFC] p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">School Days</p>
                <p className="mt-1 font-semibold text-gray-900">{teacher.total_school_days ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Status Control</h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose one teacher lifecycle state. Each change requires confirmation.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {(Object.keys(STATUS_META) as TeacherStatus[]).map((status) => {
                const selected = form.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => requestStatusChange(status)}
                    disabled={mode === "view"}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      selected ? STATUS_META[status].active : STATUS_META[status].idle
                    } ${mode === "view" ? "cursor-default opacity-80" : "hover:scale-[1.01]"}`}
                  >
                    {STATUS_META[status].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Verification Actions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Trigger verification when email or phone is changed.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => void handleVerify("email")}
                disabled={!form.email || verifying !== null}
                className="rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                {verifying === "email" ? "Sending..." : "Verify Email"}
              </button>
              <button
                onClick={() => void handleVerify("phone")}
                disabled={!form.phone || verifying !== null}
                className="rounded-[14px] border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-50"
              >
                {verifying === "phone" ? "Sending..." : "Verify Phone"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Teacher Details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Full Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  disabled={mode === "view"}
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Admission Number
                </label>
                <input
                  value={form.admission_number}
                  onChange={(e) => updateForm("admission_number", e.target.value)}
                  disabled={mode === "view"}
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email
                </label>
                <input
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  disabled={mode === "view"}
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  disabled={mode === "view"}
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Subjects</h3>
            <p className="mt-1 text-sm text-gray-500">
              Assign one or more subjects. First selected subject becomes the default primary subject.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              {subjects.map((subject) => {
                const selected = assignedSubjectIds.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    disabled={mode === "view"}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      selected
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {subject.subject_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Class Assignment</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select classes this teacher handles and define the class they officially lead.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {classes.map((cls) => {
                const selected = assignedClassIds.includes(cls.id);
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => toggleAssignedClass(cls.id)}
                    disabled={mode === "view"}
                    className={`flex items-center justify-between rounded-[18px] border px-4 py-3 text-sm ${
                      selected
                        ? "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span>{formatClassName(cls)}</span>
                    {selected && <span className="text-xs font-bold">Assigned</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Class Teacher For
              </label>
              <select
                value={classTeacherForClassId}
                onChange={(e) => setClassTeacherForClassId(e.target.value)}
                disabled={mode === "view" || !form.class_teacher}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="">No class teacher ownership</option>
                {assignedClassIds.map((classId) => {
                  const cls = classMap.get(classId);
                  return (
                    <option key={classId} value={classId}>
                      {formatClassName(cls)}
                    </option>
                  );
                })}
              </select>

              <label className="mt-4 flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.class_teacher}
                  onChange={(e) => updateForm("class_teacher", e.target.checked)}
                  disabled={mode === "view"}
                />
                Mark this teacher as a class teacher
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Default Weekly Timetable</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Drag items between days, click tiles to edit, or add new class, event, duty, or task blocks.
                </p>
              </div>

              {mode === "edit" && (
                <button
                  onClick={() => openNewSlot()}
                  className="rounded-[14px] bg-[#F19F24] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d88915]"
                >
                  Add Slot
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[1100px] grid-cols-[100px_repeat(7,1fr)] gap-3">
                <div />
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-3 py-3 text-center text-sm font-semibold text-gray-700"
                  >
                    {labelDay(day)}
                  </div>
                ))}

                {SLOT_STARTS.map((slotStart) => (
                  <>
                    <div
                      key={`time-${slotStart}`}
                      className="rounded-[16px] border border-gray-100 bg-white px-3 py-4 text-sm font-semibold text-gray-500"
                    >
                      {slotStart}
                    </div>

                    {DAYS.map((day) => {
                      const items = groupedByDay[day]?.filter(
                        (row) => row.start_time === slotStart,
                      ) ?? [];

                      return (
                        <div
                          key={`${day}-${slotStart}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDrop(day, slotStart)}
                          onDoubleClick={() => openNewSlot(day, slotStart)}
                          className="min-h-[96px] rounded-[18px] border border-dashed border-gray-200 bg-[#FCFCFC] p-2"
                        >
                          <div className="flex h-full flex-col gap-2">
                            {items.map((item) => (
                              <button
                                key={item.id}
                                draggable={mode === "edit"}
                                onDragStart={() => onDragStart(item.id)}
                                onClick={() => openEditSlot(item)}
                                className={`rounded-[14px] border px-3 py-2 text-left text-xs font-semibold ${tileStyle(
                                  item.item_type,
                                )}`}
                              >
                                <div className="truncate">
                                  {item.item_type === "class"
                                    ? formatClassName(
                                        item.class_id ? classMap.get(item.class_id) : null,
                                      )
                                    : item.title || item.item_type}
                                </div>
                                <div className="mt-1 truncate text-[11px] opacity-80">
                                  {item.start_time} - {item.end_time}
                                  {item.subject_id
                                    ? ` • ${subjectMap.get(String(item.subject_id)) ?? "Subject"}`
                                    : ""}
                                </div>
                              </button>
                            ))}

                            {mode === "edit" && items.length === 0 && (
                              <button
                                onClick={() => openNewSlot(day, slotStart)}
                                className="flex min-h-[72px] items-center justify-center rounded-[14px] border border-dashed border-gray-200 text-xs font-semibold text-gray-400 hover:text-[#F19F24]"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-gray-100 bg-[#FCFCFC] p-4">
              <h4 className="text-sm font-semibold text-gray-900">Assigned Class Overview</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {assignedClassIds.length === 0 ? (
                  <span className="text-sm text-gray-500">No classes assigned yet.</span>
                ) : (
                  assignedClassIds.map((id) => (
                    <span
                      key={id}
                      className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700"
                    >
                      {formatClassName(classMap.get(id))}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showStatusConfirm && statusCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Confirm Status Change</h3>
            <p className="mt-2 text-sm text-gray-600">
              Change teacher status from{" "}
              <span className="font-semibold">{STATUS_META[form.status].label}</span> to{" "}
              <span className="font-semibold">{STATUS_META[statusCandidate].label}</span>?
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={cancelStatusChange}
                className="rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                className="rounded-[14px] bg-[#F19F24] px-4 py-2 text-sm font-semibold text-white"
              >
                Yes, Change
              </button>
            </div>
          </div>
        </div>
      )}

      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-900">
                {editingSlot ? "Edit Schedule Item" : "Add Schedule Item"}
              </h3>
              <button
                onClick={closeSlotModal}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Item Type
                </label>
                <select
                  value={slotForm.item_type}
                  onChange={(e) =>
                    setSlotForm((prev) => ({
                      ...prev,
                      item_type: e.target.value as TimetableItemType,
                    }))
                  }
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                >
                  <option value="class">Class</option>
                  <option value="event">Event</option>
                  <option value="duty">Duty</option>
                  <option value="task">Task</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Day
                </label>
                <select
                  value={slotForm.day_of_week}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, day_of_week: e.target.value }))
                  }
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {labelDay(day)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Start Time
                </label>
                <input
                  type="time"
                  value={slotForm.start_time}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  End Time
                </label>
                <input
                  type="time"
                  value={slotForm.end_time}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, end_time: e.target.value }))
                  }
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              {slotForm.item_type === "class" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Class
                    </label>
                    <select
                      value={slotForm.class_id}
                      onChange={(e) =>
                        setSlotForm((prev) => ({ ...prev, class_id: e.target.value }))
                      }
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Select class</option>
                      {assignedClassIds.map((id) => (
                        <option key={id} value={id}>
                          {formatClassName(classMap.get(id))}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Subject
                    </label>
                    <select
                      value={slotForm.subject_id}
                      onChange={(e) =>
                        setSlotForm((prev) => ({ ...prev, subject_id: e.target.value }))
                      }
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Select subject</option>
                      {assignedSubjectIds.map((id) => (
                        <option key={id} value={String(id)}>
                          {subjectMap.get(String(id))}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Title
                  </label>
                  <input
                    value={slotForm.title}
                    onChange={(e) =>
                      setSlotForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. Assembly Duty, Parent Meeting, Marking Task"
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Room / Location
                </label>
                <input
                  value={slotForm.room}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, room: e.target.value }))
                  }
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </label>
                <textarea
                  value={slotForm.notes}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div>
                {editingSlot && (
                  <button
                    onClick={() => {
                      deleteSlotLocal(editingSlot.id);
                      closeSlotModal();
                    }}
                    className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={closeSlotModal}
                  className="rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSlotLocal}
                  className="rounded-[14px] bg-[#F19F24] px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}