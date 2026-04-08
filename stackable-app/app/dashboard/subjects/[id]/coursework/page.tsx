
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookPlus, Eye, FolderPlus, Link2, Upload } from "lucide-react";
import ConfirmationModal from "@/components/Confirmation-Modal/modal";
import CurriculumTree from "@/components/subjects/CurriculumTree";
import MediaViewer from "@/components/subjects/MediaViewer";
import SubjectSlideOver from "@/components/subjects/SlideOver";
import {
  RESOURCE_TYPE_OPTIONS,
  classNames,
  formatDate,
  formatEnumLabel,
  getSubjectHeroImage,
  type CourseworkOutlineNode,
  type SubjectCourseworkPayload,
  type SubjectResourceCard,
} from "@/lib/subjects";

type TopicFormState = {
  title: string;
  node_type: string;
  parent_id: string;
  sort_order: string;
};

type ResourceFormState = {
  resource_type: string;
  curriculum_node_id: string;
  title: string;
  short_description: string;
  author_name: string;
  cover_image_url: string;
  source_url: string;
  visibility: string;
};

type ProgressFormState = {
  current_node_id: string;
  syllabus_progress_pct: string;
};

const INITIAL_TOPIC_FORM: TopicFormState = {
  title: "",
  node_type: "topic",
  parent_id: "",
  sort_order: "0",
};

const INITIAL_RESOURCE_FORM: ResourceFormState = {
  resource_type: "document",
  curriculum_node_id: "",
  title: "",
  short_description: "",
  author_name: "",
  cover_image_url: "",
  source_url: "",
  visibility: "private",
};

const INITIAL_PROGRESS_FORM: ProgressFormState = {
  current_node_id: "",
  syllabus_progress_pct: "0",
};

function flattenNodes(
  nodes: CourseworkOutlineNode[],
  prefix = "",
): Array<{ id: string; label: string }> {
  return nodes.flatMap((node) => {
    const label = `${prefix}${node.title}`;
    return [{ id: node.id, label }, ...flattenNodes(node.children, `${prefix}• `)];
  });
}

function getResourceHref(resource: SubjectResourceCard) {
  if (resource.storagePath) {
    return `/api/subjects/resource?path=${encodeURIComponent(resource.storagePath)}`;
  }

  return resource.sourceUrl || "#";
}

function canPreview(resource: SubjectResourceCard) {
  return ["video", "audio", "link"].includes(resource.resourceType) || Boolean(resource.sourceUrl);
}

export default function SubjectCourseworkPage() {
  const params = useParams();
  const subjectId = params?.id as string;
  const [payload, setPayload] = useState<SubjectCourseworkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClassOfferingId, setSelectedClassOfferingId] = useState("");
  const [resourceFilter, setResourceFilter] = useState("all");
  const [topicOpen, setTopicOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [topicForm, setTopicForm] = useState(INITIAL_TOPIC_FORM);
  const [resourceForm, setResourceForm] = useState(INITIAL_RESOURCE_FORM);
  const [progressForm, setProgressForm] = useState(INITIAL_PROGRESS_FORM);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewerResource, setViewerResource] = useState<SubjectResourceCard | null>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<SubjectResourceCard | null>(null);

  useEffect(() => {
    async function loadCoursework() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/subjects/${subjectId}/coursework`, { cache: "no-store" });
        const response = (await res.json()) as {
          error?: string;
          data?: SubjectCourseworkPayload;
        };
        if (!res.ok || !response.data) {
          throw new Error(response.error || "Failed to load coursework.");
        }
        setPayload(response.data);
        setSelectedClassOfferingId((current) => current || response.data?.classOfferings[0]?.id || "");
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load coursework.");
      } finally {
        setLoading(false);
      }
    }

    if (subjectId) {
      void loadCoursework();
    }
  }, [subjectId]);

  useEffect(() => {
    if (!payload?.classOfferings.length) return;
    const exists = payload.classOfferings.some((item) => item.id === selectedClassOfferingId);
    if (!exists) setSelectedClassOfferingId(payload.classOfferings[0]?.id || "");
  }, [payload, selectedClassOfferingId]);

  const selectedClass = payload?.classOfferings.find((item) => item.id === selectedClassOfferingId) ?? null;
  const selectedNodes = useMemo(() => payload?.curriculumByClass[selectedClassOfferingId] ?? [], [payload, selectedClassOfferingId]);
  const flatNodes = useMemo(() => flattenNodes(selectedNodes), [selectedNodes]);
  const selectedResources = useMemo(() => payload?.resourcesByClass[selectedClassOfferingId] ?? [], [payload, selectedClassOfferingId]);
  const filteredResources = useMemo(() => resourceFilter === "all" ? selectedResources : selectedResources.filter((item) => item.resourceType === resourceFilter), [resourceFilter, selectedResources]);

  useEffect(() => {
    if (!selectedClass) {
      setProgressForm(INITIAL_PROGRESS_FORM);
      return;
    }

    setProgressForm({
      current_node_id: selectedClass.currentNodeId || "",
      syllabus_progress_pct: String(selectedClass.progressPct ?? 0),
    });
  }, [selectedClass]);

  async function handleCreateTopic() {
    if (!selectedClassOfferingId) {
      setError("Select a class before adding a topic.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const formData = new FormData();
      formData.set("action", "create_topic");
      formData.set("school_subject_class_id", selectedClassOfferingId);
      formData.set("title", topicForm.title);
      formData.set("node_type", topicForm.node_type);
      formData.set("sort_order", topicForm.sort_order);
      if (topicForm.parent_id) formData.set("parent_id", topicForm.parent_id);

      const res = await fetch(`/api/subjects/${subjectId}/coursework`, { method: "POST", body: formData });
      const response = (await res.json()) as { error?: string; data?: SubjectCourseworkPayload };
      if (!res.ok || !response.data) throw new Error(response.error || "Failed to create topic.");

      setPayload(response.data);
      setTopicOpen(false);
      setTopicForm(INITIAL_TOPIC_FORM);
    } catch (topicError) {
      console.error(topicError);
      setError(topicError instanceof Error ? topicError.message : "Failed to create topic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateResource() {
    if (!selectedClassOfferingId) {
      setError("Select a class before adding a resource.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const formData = new FormData();
      formData.set("action", "create_resource");
      formData.set("school_subject_class_id", selectedClassOfferingId);
      formData.set("resource_type", resourceForm.resource_type);
      formData.set("title", resourceForm.title);
      formData.set("short_description", resourceForm.short_description);
      formData.set("author_name", resourceForm.author_name);
      formData.set("cover_image_url", resourceForm.cover_image_url);
      formData.set("source_url", resourceForm.source_url);
      formData.set("visibility", resourceForm.visibility);
      if (resourceForm.curriculum_node_id) formData.set("curriculum_node_id", resourceForm.curriculum_node_id);
      if (resourceFile) formData.set("file", resourceFile);

      const res = await fetch(`/api/subjects/${subjectId}/coursework`, { method: "POST", body: formData });
      const response = (await res.json()) as { error?: string; data?: SubjectCourseworkPayload };
      if (!res.ok || !response.data) throw new Error(response.error || "Failed to create resource.");

      setPayload(response.data);
      setResourceOpen(false);
      setResourceForm(INITIAL_RESOURCE_FORM);
      setResourceFile(null);
    } catch (resourceError) {
      console.error(resourceError);
      setError(resourceError instanceof Error ? resourceError.message : "Failed to create resource.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProgress() {
    if (!selectedClassOfferingId) {
      setError("Select a class before updating progress.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const res = await fetch(`/api/subjects/${subjectId}/coursework`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_progress",
          school_subject_class_id: selectedClassOfferingId,
          current_node_id: progressForm.current_node_id || null,
          syllabus_progress_pct: Number(progressForm.syllabus_progress_pct),
        }),
      });
      const response = (await res.json()) as { error?: string; data?: SubjectCourseworkPayload };
      if (!res.ok || !response.data) throw new Error(response.error || "Failed to update progress.");
      setPayload(response.data);
    } catch (progressError) {
      console.error(progressError);
      setError(progressError instanceof Error ? progressError.message : "Failed to update progress.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmVisibilitySwitch() {
    if (!visibilityTarget) return;

    try {
      setSaving(true);
      setError("");
      const res = await fetch(`/api/subjects/${subjectId}/coursework`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_visibility",
          resource_id: visibilityTarget.id,
          next_visibility: visibilityTarget.visibility === "public" ? "private" : "public",
        }),
      });
      const response = (await res.json()) as { error?: string; data?: SubjectCourseworkPayload };
      if (!res.ok || !response.data) throw new Error(response.error || "Failed to update visibility.");

      setPayload(response.data);
      setVisibilityTarget(null);
    } catch (toggleError) {
      console.error(toggleError);
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update visibility.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenResource(resource: SubjectResourceCard) {
    if (canPreview(resource)) {
      setViewerResource(resource);
      return;
    }

    const href = getResourceHref(resource);
    if (href && href !== "#") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading coursework...</p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="p-6">
        <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-gray-900">Coursework unavailable</h3>
          <p className="mt-2 text-sm text-gray-500">{error || "The coursework workspace could not be loaded."}</p>
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const heroImage = getSubjectHeroImage(payload.subjectId, payload.abstractImageUrl);

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/subjects/${subjectId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#007146] transition hover:text-[#F19F24]">
            <ArrowLeft className="h-4 w-4" />
            Back to subject detail
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setTopicOpen(true)} className="inline-flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
            <FolderPlus className="h-4 w-4" />
            Add Topic
          </button>
          <button type="button" onClick={() => setResourceOpen(true)} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white">
            <BookPlus className="h-4 w-4" />
            Add Resource
          </button>
        </div>
      </div>

      {error ? <div className="mb-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-gray-100 shadow-sm">
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={`${payload.title} background`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-slate-950/10" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.16)_0%,rgba(15,23,42,0.1)_35%,rgba(15,23,42,0.22)_100%)]" />
          </div>
          <div className="relative flex min-h-[280px] items-center justify-center px-6 py-12 text-center">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-white/20 bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{payload.schoolName}</div>
              <h1 className="mt-4 text-[34px] font-bold tracking-tight text-white md:text-[42px]">{payload.title} Coursework</h1>
              <p className="mt-4 text-sm leading-7 text-white/88">{payload.description || payload.strapline || "Select a class offering, follow syllabus progress, and manage subject resources in one shared command center."}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Offered Classes</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">Choose the class you want to manage</h2>
                <p className="mt-1 text-sm text-gray-500">Coursework, topic completion, and resources are grouped per class offering.</p>
              </div>
              <div className="rounded-full border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-2 text-sm font-semibold text-[#007146]">{payload.schoolName}</div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {payload.classOfferings.length > 0 ? payload.classOfferings.map((classOffering) => (
                <button key={classOffering.id} type="button" onClick={() => setSelectedClassOfferingId(classOffering.id)} className={classNames("rounded-[18px] border px-4 py-3 text-left transition", selectedClassOfferingId === classOffering.id ? "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146] shadow-sm" : "border-gray-200 bg-white text-gray-600 hover:border-[#F19F24] hover:text-[#F19F24]")}>
                  <div className="text-sm font-semibold">{classOffering.classLabel}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] opacity-70">{Math.round(classOffering.progressPct ?? 0)}% covered</div>
                </button>
              )) : <div className="rounded-[22px] border border-dashed border-gray-300 bg-[#FCFCFC] px-5 py-8 text-sm text-gray-500">No classes are linked to this subject offering yet.</div>}
            </div>
          </div>
        </section>

        {selectedClass ? (
          <>
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Progress Overview</p>
                    <h2 className="mt-2 text-xl font-semibold text-gray-900">{selectedClass.classLabel} syllabus roadmap</h2>
                    <p className="mt-1 text-sm text-gray-500">Keep the current topic and percentage covered in sync with the class.</p>
                  </div>
                  <div className="rounded-[18px] border border-[#FFE2B8] bg-[#FFF4E2] px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#B76A00]">Covered</p>
                    <p className="mt-1 text-2xl font-bold text-[#7B4A04]">{Math.round(Number(progressForm.syllabus_progress_pct || 0))}%</p>
                  </div>
                </div>

                <div className="mt-5 h-4 overflow-hidden rounded-full bg-[#F4F4F1]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#108548_0%,#F19F24_100%)] transition-all" style={{ width: `${Math.max(0, Math.min(100, Number(progressForm.syllabus_progress_pct || 0)))}%` }} />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Current topic</label>
                    <select value={progressForm.current_node_id} onChange={(event) => setProgressForm((current) => ({ ...current, current_node_id: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                      <option value="">No current topic selected</option>
                      {flatNodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Percentage covered</label>
                    <div className="rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-4">
                      <input type="range" min="0" max="100" value={progressForm.syllabus_progress_pct} onChange={(event) => setProgressForm((current) => ({ ...current, syllabus_progress_pct: event.target.value }))} className="w-full accent-[#108548]" />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <input type="number" min="0" max="100" value={progressForm.syllabus_progress_pct} onChange={(event) => setProgressForm((current) => ({ ...current, syllabus_progress_pct: event.target.value }))} className="w-24 rounded-[14px] border border-gray-200 bg-white px-3 py-2 text-sm outline-none" />
                        <button type="button" onClick={() => void handleSaveProgress()} disabled={saving} className="inline-flex rounded-[14px] bg-[#108548] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save progress</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Class Summary</p>
                <h2 className="mt-2 text-xl font-semibold text-gray-900">What is active right now</h2>
                <div className="mt-5 space-y-4">
                  <div className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Selected class</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{selectedClass.classLabel}</p>
                  </div>
                  <div className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Current topic</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{flatNodes.find((node) => node.id === progressForm.current_node_id)?.label || "No topic selected"}</p>
                  </div>
                  <div className="rounded-[22px] border border-gray-100 bg-[#FCFCFC] p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Resources available</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{selectedResources.length}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Table of Content</p>
                      <h2 className="mt-2 text-xl font-semibold text-gray-900">Curriculum roadmap</h2>
                      <p className="mt-1 text-sm text-gray-500">Completed topics strike through, partial branches fade back, and the current topic stays highlighted.</p>
                    </div>
                    <button type="button" onClick={() => setTopicOpen(true)} className="inline-flex items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                      <FolderPlus className="h-4 w-4" />
                      Add Topic
                    </button>
                  </div>

                  <CurriculumTree nodes={selectedNodes} currentNodeId={selectedClass.currentNodeId || progressForm.current_node_id || null} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Resource Library</p>
                      <h2 className="mt-2 text-xl font-semibold text-gray-900">Coursework content for {selectedClass.classLabel}</h2>
                      <p className="mt-1 text-sm text-gray-500">Filter by media type, preview playable content, and control private or public visibility.</p>
                    </div>
                    <button type="button" onClick={() => setResourceOpen(true)} className="inline-flex items-center gap-2 rounded-[14px] bg-[#F19F24] px-4 py-2 text-sm font-semibold text-white">
                      <BookPlus className="h-4 w-4" />
                      Add Content
                    </button>
                  </div>

                  <div className="mb-5 flex flex-wrap gap-2">
                    {(["all", ...RESOURCE_TYPE_OPTIONS] as const).map((item) => (
                      <button key={item} type="button" onClick={() => setResourceFilter(item)} className={classNames("rounded-full border px-4 py-2 text-sm font-semibold transition", resourceFilter === item ? "border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]" : "border-gray-200 bg-white text-gray-600 hover:border-[#F19F24] hover:text-[#F19F24]")}>
                        {item === "all" ? "All content" : formatEnumLabel(item)}
                      </button>
                    ))}
                  </div>

                  {filteredResources.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {filteredResources.map((resource) => {
                        const href = getResourceHref(resource);
                        return (
                          <article key={resource.id} className="overflow-hidden rounded-[24px] border border-gray-100 bg-[#FCFCFC] shadow-sm">
                            <div className="relative h-40 overflow-hidden bg-[linear-gradient(135deg,#fff0cb_0%,#f5f7ff_100%)]">
                              {resource.coverImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={resource.coverImageUrl} alt={resource.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,133,72,0.12),transparent_35%)]" />
                              )}
                              <div className="absolute left-4 top-4 inline-flex rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold text-gray-700 backdrop-blur">{resource.visibility}</div>
                            </div>

                            <div className="space-y-4 p-5">
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{formatEnumLabel(resource.resourceType)}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-gray-900">{resource.title}</h3>
                                  </div>
                                  <button type="button" onClick={() => setVisibilityTarget(resource)} className="rounded-[12px] border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                                    Make {resource.visibility === "public" ? "private" : "public"}
                                  </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">{resource.shortDescription || "No description added yet."}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm text-gray-500">
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-gray-400">Author</p>
                                  <p className="mt-1 font-medium text-gray-800">{resource.authorName || "Unknown"}</p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wide text-gray-400">Uploaded</p>
                                  <p className="mt-1 font-medium text-gray-800">{formatDate(resource.uploadedAt)}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <button type="button" onClick={() => handleOpenResource(resource)} className="inline-flex items-center gap-2 rounded-[14px] bg-[#108548] px-4 py-2 text-sm font-semibold text-white">
                                  <Eye className="h-4 w-4" />
                                  {canPreview(resource) ? "View content" : "Open file"}
                                </button>
                                {href !== "#" ? (
                                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
                                    {resource.storagePath ? <Upload className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                                    {resource.storagePath ? "Download" : "Open link"}
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-gray-300 bg-[#FCFCFC] px-5 py-14 text-center text-sm text-gray-500">No resources match the selected filter for this class yet.</div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <SubjectSlideOver open={topicOpen} onClose={() => setTopicOpen(false)} title="Add Topic" subtitle="Create a topic or subtopic for the currently selected class offering">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Class offering</label>
                <div className="rounded-[18px] border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-3 text-sm font-semibold text-[#007146]">{selectedClass?.classLabel || "Select a class first"}</div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Topic title</label>
                <input value={topicForm.title} onChange={(event) => setTopicForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Quadratic equations" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Node type</label>
                <select value={topicForm.node_type} onChange={(event) => setTopicForm((current) => ({ ...current, node_type: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                  <option value="topic">Topic</option>
                  <option value="subtopic">Subtopic</option>
                  <option value="subtopic_item">Subtopic item</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Sort order</label>
                <input type="number" value={topicForm.sort_order} onChange={(event) => setTopicForm((current) => ({ ...current, sort_order: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Parent topic</label>
                <select value={topicForm.parent_id} onChange={(event) => setTopicForm((current) => ({ ...current, parent_id: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                  <option value="">Top-level topic</option>
                  {flatNodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleCreateTopic()} disabled={saving} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <FolderPlus className="h-4 w-4" />
              {saving ? "Saving..." : "Create Topic"}
            </button>
            <button type="button" onClick={() => setTopicOpen(false)} className="inline-flex rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      </SubjectSlideOver>

      <SubjectSlideOver open={resourceOpen} onClose={() => setResourceOpen(false)} title="Add Resource" subtitle="Upload a file or attach a link to the selected class and topic">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Class offering</label>
                <div className="rounded-[18px] border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-3 text-sm font-semibold text-[#007146]">{selectedClass?.classLabel || "Select a class first"}</div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Resource type</label>
                <select value={resourceForm.resource_type} onChange={(event) => setResourceForm((current) => ({ ...current, resource_type: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                  {RESOURCE_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Visibility</label>
                <select value={resourceForm.visibility} onChange={(event) => setResourceForm((current) => ({ ...current, visibility: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Title</label>
                <input value={resourceForm.title} onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Revision worksheet" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Short description</label>
                <textarea value={resourceForm.short_description} onChange={(event) => setResourceForm((current) => ({ ...current, short_description: event.target.value }))} className="min-h-[110px] w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="A concise summary of the resource" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Author</label>
                <input value={resourceForm.author_name} onChange={(event) => setResourceForm((current) => ({ ...current, author_name: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="Department team" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Cover image URL</label>
                <input value={resourceForm.cover_image_url} onChange={(event) => setResourceForm((current) => ({ ...current, cover_image_url: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="https://..." />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Topic</label>
                <select value={resourceForm.curriculum_node_id} onChange={(event) => setResourceForm((current) => ({ ...current, curriculum_node_id: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none">
                  <option value="">No linked topic</option>
                  {flatNodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Source URL</label>
                <input value={resourceForm.source_url} onChange={(event) => setResourceForm((current) => ({ ...current, source_url: event.target.value }))} className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none" placeholder="https://youtube.com/..." />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Upload file</label>
                <label className="flex cursor-pointer items-center justify-between rounded-[18px] border border-dashed border-gray-300 bg-[#FCFCFC] px-4 py-4 text-sm text-gray-600">
                  <span className="truncate">{resourceFile ? resourceFile.name : "Choose a file to upload"}</span>
                  <span className="inline-flex items-center gap-2 rounded-[12px] bg-white px-3 py-2 font-semibold text-gray-700 shadow-sm">
                    <Upload className="h-4 w-4" />
                    Browse
                  </span>
                  <input type="file" className="hidden" onChange={(event) => setResourceFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void handleCreateResource()} disabled={saving} className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              <BookPlus className="h-4 w-4" />
              {saving ? "Saving..." : "Create Resource"}
            </button>
            <button type="button" onClick={() => setResourceOpen(false)} className="inline-flex rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700">Cancel</button>
          </div>
        </div>
      </SubjectSlideOver>

      <MediaViewer open={Boolean(viewerResource)} resource={viewerResource} onClose={() => setViewerResource(null)} />

      <ConfirmationModal
        open={Boolean(visibilityTarget)}
        title="Change Resource Visibility"
        message={`Are you sure you want to make this resource ${visibilityTarget?.visibility === "public" ? "private" : "public"}? This action will be recorded in the visibility history.`}
        onClose={() => setVisibilityTarget(null)}
        onConfirm={() => void confirmVisibilitySwitch()}
        confirmLabel={saving ? "Saving..." : "Confirm change"}
        loading={saving}
        tone="warning"
      />
    </div>
  );
}
