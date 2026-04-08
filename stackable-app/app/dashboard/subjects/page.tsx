"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  BookCopy,
  CalendarClock,
  Eye,
  Filter,
  Grid2X2,
  PencilLine,
  LayoutList,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import SubjectSlideOver from "@/components/subjects/SlideOver";
import {
  ASSIGNMENT_ROLE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  SUBJECT_CATEGORY_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
  classNames,
  formatEnumLabel,
  formatPercent,
  getInitials,
  getSubjectAbstractImage,
  getThemePalette,
  type SubjectDirectoryPayload,
} from "@/lib/subjects";

type ViewMode = "grid" | "list";

type CreateTeacherAssignment = {
  teacher_id: string;
  assignment_role: string;
  is_primary: boolean;
};

type CreateFormState = {
  existing_subject_id: string;
  school_id: string;
  class_ids: string[];
  subject_name: string;
  subject_code: string;
  acronym: string;
  short_name: string;
  strapline: string;
  description: string;
  department: string;
  category: string;
  subject_type: string;
  education_level: string;
  requires_lab: boolean;
  has_coursework: boolean;
  has_assessments: boolean;
  is_elective: boolean;
  is_active: boolean;
  default_sequence: string;
  theme_token: string;
  abstract_image_url: string;
  teacher_assignments: CreateTeacherAssignment[];
};

const INITIAL_FORM: CreateFormState = {
  existing_subject_id: "",
  school_id: "",
  class_ids: [],
  subject_name: "",
  subject_code: "",
  acronym: "",
  short_name: "",
  strapline: "",
  description: "",
  department: "",
  category: "core",
  subject_type: "general",
  education_level: "secondary",
  requires_lab: false,
  has_coursework: true,
  has_assessments: true,
  is_elective: false,
  is_active: true,
  default_sequence: "",
  theme_token: "amber",
  abstract_image_url: "",
  teacher_assignments: [{ teacher_id: "", assignment_role: "hod", is_primary: true }],
};

export default function SubjectsPage() {
  const [payload, setPayload] = useState<SubjectDirectoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [courseworkFilter, setCourseworkFilter] = useState("all");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [createForm, setCreateForm] = useState<CreateFormState>(INITIAL_FORM);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (backgroundPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(backgroundPreviewUrl);
      }
    };
  }, [backgroundPreviewUrl]);

  useEffect(() => {
    async function fetchSubjects() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/subjects", { cache: "no-store" });
        const response = (await res.json()) as { error?: string; data?: SubjectDirectoryPayload };
        if (!res.ok || !response.data) throw new Error(response.error || "Failed to load subjects.");
        setPayload(response.data);
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load subjects.");
      } finally {
        setLoading(false);
      }
    }

    void fetchSubjects();
  }, []);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (payload?.cards ?? []).filter((card) => {
      const matchesSearch = !q || card.title.toLowerCase().includes(q) || (card.subjectCode ?? "").toLowerCase().includes(q) || (card.department ?? "").toLowerCase().includes(q) || card.schoolName.toLowerCase().includes(q) || card.classes.some((item) => item.label.toLowerCase().includes(q));
      return matchesSearch &&
        (schoolFilter === "all" || card.schoolId === schoolFilter) &&
        (departmentFilter === "all" || (card.department ?? "") === departmentFilter) &&
        (categoryFilter === "all" || card.category === categoryFilter) &&
        (typeFilter === "all" || card.subjectType === typeFilter) &&
        (levelFilter === "all" || card.educationLevel === levelFilter) &&
        (courseworkFilter === "all" || (courseworkFilter === "yes" ? card.hasCoursework : !card.hasCoursework)) &&
        (assessmentFilter === "all" || (assessmentFilter === "yes" ? card.hasAssessments : !card.hasAssessments)) &&
        (activeFilter === "all" || (activeFilter === "yes" ? card.isActive : !card.isActive));
    });
  }, [activeFilter, assessmentFilter, categoryFilter, courseworkFilter, departmentFilter, levelFilter, payload?.cards, schoolFilter, search, typeFilter]);

  const filteredClasses = (payload?.options.classes ?? []).filter((item) => !createForm.school_id || item.school_id === createForm.school_id);
  const filteredTeachers = (payload?.options.teachers ?? []).filter((item) => !createForm.school_id || item.school_id === createForm.school_id);

  function updateForm<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }

  function resetCreateSubjectState() {
    if (backgroundPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(backgroundPreviewUrl);
    }
    setBackgroundPreviewUrl("");
    setBackgroundFile(null);
    setCreateForm(INITIAL_FORM);
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = "";
    }
  }

  function openBackgroundPicker() {
    backgroundInputRef.current?.click();
  }

  function clearBackgroundImage() {
    if (backgroundPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(backgroundPreviewUrl);
    }
    setBackgroundPreviewUrl("");
    setBackgroundFile(null);
    updateForm("abstract_image_url", "");
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = "";
    }
  }

  function handleBackgroundChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Subject background must be an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError("Subject background must be 8MB or smaller.");
      event.target.value = "";
      return;
    }

    if (backgroundPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(backgroundPreviewUrl);
    }

    setError("");
    setBackgroundFile(file);
    setBackgroundPreviewUrl(URL.createObjectURL(file));
    updateForm("abstract_image_url", "");
  }

  function toggleClass(classId: string) {
    setCreateForm((current) => ({
      ...current,
      class_ids: current.class_ids.includes(classId) ? current.class_ids.filter((item) => item !== classId) : [...current.class_ids, classId],
    }));
  }

  function updateTeacherAssignment(index: number, key: keyof CreateTeacherAssignment, value: string | boolean) {
    setCreateForm((current) => ({
      ...current,
      teacher_assignments: current.teacher_assignments.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  function addTeacherAssignment() {
    setCreateForm((current) => ({
      ...current,
      teacher_assignments: [...current.teacher_assignments, { teacher_id: "", assignment_role: "teacher", is_primary: false }],
    }));
  }

  function removeTeacherAssignment(index: number) {
    setCreateForm((current) => ({
      ...current,
      teacher_assignments: current.teacher_assignments.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function refreshDirectory() {
    const res = await fetch("/api/subjects", { cache: "no-store" });
    const response = (await res.json()) as { data?: SubjectDirectoryPayload; error?: string };
    if (!res.ok || !response.data) throw new Error(response.error || "Failed to refresh subjects.");
    setPayload(response.data);
  }

  async function handleCreateSubject() {
    try {
      setSaving(true);
      setError("");
      const res = await fetch("/api/subjects", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.set("payload", JSON.stringify({
            ...createForm,
            existing_subject_id: createForm.existing_subject_id ? Number(createForm.existing_subject_id) : null,
            default_sequence: createForm.default_sequence ? Number(createForm.default_sequence) : null,
            teacher_assignments: createForm.teacher_assignments.filter((item) => item.teacher_id),
          }));
          if (backgroundFile) {
            formData.set("background_image", backgroundFile);
          }
          return formData;
        })(),
      });
      const response = (await res.json()) as { error?: string; data?: { id: string } };
      if (!res.ok || !response.data) throw new Error(response.error || "Failed to create subject.");
      await refreshDirectory();
      setCreateOpen(false);
      resetCreateSubjectState();
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "Failed to create subject.");
    } finally {
      setSaving(false);
    }
  }

  const sharedCardClass = viewMode === "grid" ? "grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3" : "space-y-4";

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-gray-900">Subjects</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">One command center for subject setup, school offerings, teaching teams, learner performance, upcoming assessments, and coursework resources.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-[16px] border border-gray-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setViewMode("grid")} className={classNames("inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition", viewMode === "grid" ? "bg-[#F7F9E2] text-[#007146]" : "text-gray-500 hover:text-[#F19F24]")}><Grid2X2 className="h-4 w-4" />Grid</button>
            <button type="button" onClick={() => setViewMode("list")} className={classNames("inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-medium transition", viewMode === "list" ? "bg-[#F7F9E2] text-[#007146]" : "text-gray-500 hover:text-[#F19F24]")}><LayoutList className="h-4 w-4" />List</button>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-[#d88915]"><Plus className="h-4 w-4" />Add Subject</button>
        </div>
      </div>

      {error ? <div className="mb-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        <div className="mb-5 rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E2] text-[#F19F24]"><Filter className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-gray-900">Explore Subjects</h2><p className="text-sm text-gray-500">Search across school offerings, departments, levels, coursework readiness, and assessment availability.</p></div></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2"><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Search</label><div className="flex items-center rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4"><Search className="h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, code, school, department or class" className="w-full bg-transparent px-3 py-3 text-sm text-gray-700 outline-none" /></div></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">School</label><select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All schools</option>{(payload?.options.schools ?? []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Department</label><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All departments</option>{(payload?.options.departments ?? []).map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Category</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All categories</option>{SUBJECT_CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Type</label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All types</option>{SUBJECT_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Level</label><select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All levels</option>{EDUCATION_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Coursework</label><select value={courseworkFilter} onChange={(event) => setCourseworkFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All</option><option value="yes">Has coursework</option><option value="no">No coursework</option></select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Assessments</label><select value={assessmentFilter} onChange={(event) => setAssessmentFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All</option><option value="yes">Has assessments</option><option value="no">No assessments</option></select></div>
            <div><label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Active</label><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="all">All</option><option value="yes">Active</option><option value="no">Inactive</option></select></div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold text-gray-900">Subject Catalog</h2><p className="text-sm text-gray-500">{filteredCards.length} school-linked subject offerings currently visible.</p></div>
          <div className="rounded-full border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-2 text-sm font-semibold text-[#007146]">Unified academic command center</div>
        </div>

        {loading ? <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" /><p className="mt-4 text-sm text-gray-500">Loading subjects...</p></div> : null}
        {!loading && filteredCards.length === 0 ? <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm text-gray-500">No subjects match the current filters.</div> : null}
        {!loading && filteredCards.length > 0 ? <div className={sharedCardClass}>
          {filteredCards.map((card) => {
            const palette = getThemePalette(card.themeToken);
            const headerImage = getSubjectAbstractImage(card.id);
            return (
              <article key={card.id} className="overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-sm transition hover:translate-y-[-2px] hover:shadow-md">
                <div>
                  <div className="subject-card-media-shell relative h-52 overflow-hidden" style={{ background: palette.surface }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerImage} alt={`${card.title} abstract header`} className="subject-card-media h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.24)_100%)]" />
                    <div className="absolute left-5 top-5 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 backdrop-blur">{card.schoolName}</div>
                  </div>
                  <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{card.title}</h3>
                        <p className="mt-1 text-sm font-medium text-gray-500">{card.strapline}</p>
                      </div>
                      <div className="rounded-[16px] px-3 py-2 text-sm font-semibold" style={{ backgroundColor: palette.accentSoft, color: palette.accent }}>{card.subjectCode || card.acronym || "Pending code"}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <span className="rounded-full border border-gray-200 bg-[#FCFCFC] px-3 py-1">{formatEnumLabel(card.category)}</span>
                      <span className="rounded-full border border-gray-200 bg-[#FCFCFC] px-3 py-1">{formatEnumLabel(card.subjectType)}</span>
                      <span className="rounded-full border border-gray-200 bg-[#FCFCFC] px-3 py-1">{formatEnumLabel(card.educationLevel)}</span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Classes taught</p>
                      <div className="mt-2 flex flex-wrap gap-2">{card.classes.length > 0 ? card.classes.map((item) => <span key={item.id} className="rounded-full border border-[#dbe8cc] bg-[#F7F9E2] px-3 py-1 text-xs font-semibold text-[#007146]">{item.label}</span>) : <span className="text-sm text-gray-500">No linked classes yet</span>}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Students</p><p className="mt-2 text-2xl font-bold text-gray-900">{card.totalStudents}</p></div>
                      <div className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4"><p className="text-xs uppercase tracking-wide text-gray-400">Teachers</p><p className="mt-2 text-2xl font-bold text-gray-900">{card.totalTeachers}</p></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-[24px] border border-gray-100 bg-white p-4">
                      <div><p className="text-xs uppercase tracking-wide text-gray-400">Average score</p><p className="mt-2 text-lg font-bold text-gray-900">{formatPercent(card.averageScore)}</p></div>
                      <div><p className="text-xs uppercase tracking-wide text-gray-400">School rank</p><p className="mt-2 text-lg font-bold text-gray-900">{card.schoolRank ? `#${card.schoolRank}` : "-"}</p></div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex -space-x-3">{card.teachers.slice(0, 4).map((teacher) => <div key={teacher.id} title={`${teacher.name} - ${formatEnumLabel(teacher.role)}`} className="h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-[#F7F9E2] text-[#007146] shadow-sm">{teacher.profilePhoto ? <img src={teacher.profilePhoto} alt={teacher.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-semibold">{getInitials(teacher.name)}</div>}</div>)}</div>
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/subjects/${card.id}`} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]" title="View details"><Eye className="h-4 w-4" /></Link>
                        <Link href={`/dashboard/subjects/${card.id}#assessments`} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#FFE2B8] bg-[#FFF4E2] text-[#B76A00]" title="Upcoming assessments"><CalendarClock className="h-4 w-4" /></Link>
                        <Link href={`/dashboard/subjects/${card.id}/coursework`} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700" title="Coursework and resources"><BookCopy className="h-4 w-4" /></Link>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div> : null}
      </div>

      <SubjectSlideOver open={createOpen} onClose={() => { setCreateOpen(false); resetCreateSubjectState(); }} title="Add Subject" subtitle="Create or link a master subject, then connect classes and teachers for a school offering">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E2] text-[#F19F24]"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-gray-900">Master Subject Setup</h2><p className="text-sm text-gray-500">Choose an existing subject or create one with the metadata used across the dashboard.</p></div></div>
            <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundChange} />
            <div className="mb-5">
              {backgroundPreviewUrl ? (
                <div className="group relative overflow-hidden rounded-[24px] border border-gray-200 bg-[#FCFCFC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backgroundPreviewUrl} alt="Subject background preview" className="h-52 w-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/10" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-2 p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                    <button type="button" onClick={openBackgroundPicker} className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/90 text-gray-700 shadow-sm"><PencilLine className="h-4 w-4" /></button>
                    <button type="button" onClick={clearBackgroundImage} className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white/90 text-red-600 shadow-sm"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={openBackgroundPicker} className="flex h-52 w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-gray-300 bg-[#FCFCFC] px-6 text-center text-gray-500">
                  <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-white text-[#F19F24] shadow-sm"><Plus className="h-5 w-5" /></span>
                  <span className="text-base font-semibold text-gray-700">Upload background here</span>
                  <span className="mt-2 text-sm text-gray-500">This subject image will be used on the detail and coursework hero sections.</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">School</label><select value={createForm.school_id} onChange={(event) => { updateForm("school_id", event.target.value); updateForm("class_ids", []); updateForm("teacher_assignments", [{ teacher_id: "", assignment_role: "hod", is_primary: true }]); }} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="">Select school</option>{(payload?.options.schools ?? []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></div>
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Use existing subject</label><select value={createForm.existing_subject_id} onChange={(event) => updateForm("existing_subject_id", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"><option value="">Create a new master subject</option>{(payload?.options.masterSubjects ?? []).map((subject) => <option key={subject.id} value={String(subject.id)}>{subject.subject_name}{subject.subject_code ? ` - ${subject.subject_code}` : ""}</option>)}</select></div>
            </div>
            {!createForm.existing_subject_id ? (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subject name</label><input value={createForm.subject_name} onChange={(event) => updateForm("subject_name", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Mathematics" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subject code</label><input value={createForm.subject_code} onChange={(event) => updateForm("subject_code", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="MATH-01" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Acronym</label><input value={createForm.acronym} onChange={(event) => updateForm("acronym", event.target.value)} maxLength={3} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="MTH" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Short name</label><input value={createForm.short_name} onChange={(event) => updateForm("short_name", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Maths" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Department</label><input value={createForm.department} onChange={(event) => updateForm("department", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Sciences" /></div>
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Five-word strapline</label><input value={createForm.strapline} onChange={(event) => updateForm("strapline", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Analytical learning for every class" /></div>
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Description</label><textarea value={createForm.description} onChange={(event) => updateForm("description", event.target.value)} className="min-h-[120px] w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Long subject description for the detail page" /></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Category</label><select value={createForm.category} onChange={(event) => updateForm("category", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">{SUBJECT_CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subject type</label><select value={createForm.subject_type} onChange={(event) => updateForm("subject_type", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">{SUBJECT_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Education level</label><select value={createForm.education_level} onChange={(event) => updateForm("education_level", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">{EDUCATION_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Theme token</label><select value={createForm.theme_token} onChange={(event) => updateForm("theme_token", event.target.value)} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"><option value="amber">Amber</option><option value="lime">Lime</option><option value="ocean">Ocean</option><option value="coral">Coral</option><option value="violet">Violet</option></select></div>
                <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Default sequence</label><input value={createForm.default_sequence} onChange={(event) => updateForm("default_sequence", event.target.value)} type="number" className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="1" /></div>
                <div className="md:col-span-2 grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Requires lab", "requires_lab"],["Has coursework", "has_coursework"],["Has assessments", "has_assessments"],["Elective", "is_elective"],["Active", "is_active"]].map(([label, key]) => <label key={key} className="flex items-center gap-3 rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm font-medium text-gray-700"><input type="checkbox" checked={createForm[key as keyof CreateFormState] as boolean} onChange={(event) => updateForm(key as keyof CreateFormState, event.target.checked as never)} />{label}</label>)}</div>
              </div>
            ) : <div className="mt-5 rounded-[22px] border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-4 text-sm text-[#2F5E46]">You are linking an existing master subject and only creating the school-specific offering below.</div>}
          </div>

          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F9E2] text-[#007146]"><Users className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-gray-900">School Offering Setup</h2><p className="text-sm text-gray-500">Pick the classes where the subject is offered and the teachers responsible for it.</p></div></div>
            <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Classes</label><div className="flex flex-wrap gap-2">{filteredClasses.map((classItem) => <button key={classItem.id} type="button" onClick={() => toggleClass(classItem.id)} className={classNames("rounded-full border px-4 py-2 text-sm font-semibold transition", createForm.class_ids.includes(classItem.id) ? "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]" : "border-gray-200 bg-white text-gray-600")}>{classItem.stream ? `${classItem.class_name} ${classItem.stream}` : classItem.class_name}</button>)}</div></div>
            <div className="mt-6 space-y-4">{createForm.teacher_assignments.map((item, index) => <div key={`${item.teacher_id}-${index}`} className="grid grid-cols-1 gap-3 rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4 md:grid-cols-[1fr_180px_140px_auto] md:items-center"><select value={item.teacher_id} onChange={(event) => updateTeacherAssignment(index, "teacher_id", event.target.value)} className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none"><option value="">Select teacher</option>{filteredTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select><select value={item.assignment_role} onChange={(event) => updateTeacherAssignment(index, "assignment_role", event.target.value)} className="rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none">{ASSIGNMENT_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{formatEnumLabel(role)}</option>)}</select><label className="flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700"><input type="checkbox" checked={item.is_primary} onChange={(event) => updateTeacherAssignment(index, "is_primary", event.target.checked)} />Primary</label><button type="button" onClick={() => removeTeacherAssignment(index)} className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">Remove</button></div>)}<button type="button" onClick={addTeacherAssignment} className="inline-flex rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">Add teacher assignment</button></div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleCreateSubject()} disabled={saving} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#d88915] disabled:opacity-50"><Plus className="h-4 w-4" />{saving ? "Creating..." : "Create Subject"}</button>
            <button type="button" onClick={() => { setCreateOpen(false); resetCreateSubjectState(); }} className="inline-flex rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      </SubjectSlideOver>
    </div>
  );
}

