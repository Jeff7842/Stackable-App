// =============================================================================
// useSubjects — TanStack Query hooks for the admin Subjects area.
// -----------------------------------------------------------------------------
// This file is the CONTRACT between the subjects API (app/api/subjects/**) and the
// subjects UI. Every request/response type the UI needs is exported from here.
//
// Conventions
//   * Query hooks return the API's `data` payload itself (NOT the { ok, data }
//     envelope), e.g. useSubjects().data is a SubjectDirectoryPayload.
//   * Mutation hooks resolve with the API's `data` payload too, so
//     `await mutateAsync(...)` gives the refreshed list/tree.
//   * Every mutation invalidates qk.subjects.all, so lists, detail, assessments
//     and coursework refetch on their own. The server cache is bumped per school
//     on every write, so "add a subject, then see it" is always fresh.
//   * Failures reject with HttpError (lib/api/http): .message is safe to show,
//     .status is the HTTP status, .code is one of SUBJECT_ERROR_CODES (or a generic
//     BAD_REQUEST / FORBIDDEN / UNAUTHORIZED / RATE_LIMITED / INTERNAL), and
//     .details carries the per-field problems on a 400 from validation.
//   * The school is always taken from the session on the server. Nothing here
//     (or in the payloads) selects a school.
// =============================================================================

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, apiSendForm } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";
import type {
  AssessmentType,
  AssignmentRole,
  ClassFormOption,
  CurriculumNodeType,
  EducationLevel,
  ResourceType,
  ResourceVisibility,
  SchoolFormOption,
  SubjectAssessmentsPayload,
  SubjectCategory,
  SubjectCourseworkPayload,
  SubjectDetailPayload,
  SubjectDirectoryPayload,
  SubjectFormOption,
  SubjectType,
  TeacherFormOption,
} from "@/lib/subjects";

// ---------------------------------------------------------------------------
// Response types (re-exported so pages import everything from this file)
// ---------------------------------------------------------------------------

export type {
  AssessmentTimelineItem,
  ClassFormOption,
  CourseworkOutlineNode,
  SchoolFormOption,
  SubjectAssessmentsPayload,
  SubjectClassPerformanceRow,
  SubjectCourseworkClassOption,
  SubjectCourseworkPayload,
  SubjectDetailPayload,
  SubjectDirectoryCard,
  SubjectDirectoryPayload,
  SubjectFormOption,
  SubjectPerformancePoint,
  SubjectResourceCard,
  SubjectStudentRow,
  SubjectTeacherRow,
  TeacherFormOption,
} from "@/lib/subjects";

/** Every API answer is wrapped as { ok: true, data }; the hooks unwrap it. */
export type SubjectsEnvelope<T> = { ok: true; data: T };

/** Form option lists. schools/classes/teachers are ONLY the caller's school; masterSubjects is the shared catalogue. */
export type CreateSubjectOptions = {
  schools: SchoolFormOption[];
  classes: ClassFormOption[];
  teachers: TeacherFormOption[];
  masterSubjects: SubjectFormOption[];
};

/** Result of creating a subject offering. `id` is the school offering id used in /dashboard/subjects/[id]. */
export type CreateSubjectResult = {
  /** school_subjects.id: the id every other subject endpoint/page uses. */
  id: string;
  /** subjects.id: the shared master subject. */
  subject_id: number;
  school_id: string;
  options: CreateSubjectOptions;
};

// ---------------------------------------------------------------------------
// Request types (snake_case = the exact JSON/form field names the API reads)
// ---------------------------------------------------------------------------

export type CreateSubjectTeacherAssignment = {
  /** A teacher of the caller's school (others are ignored). */
  teacher_id: string;
  /** hod | lead | teacher | assistant | examiner. Defaults to "teacher". */
  assignment_role?: AssignmentRole | string;
  is_primary?: boolean;
};

/**
 * The JSON the "Add subject" form sends. Every field is optional; blanks ("" / null)
 * mean "not set". Either `existing_subject_id` OR `subject_name` is required.
 * Unknown keys (e.g. the old form's `school_id`) are ignored: the school is the session's.
 */
export type CreateSubjectPayload = {
  /** Link an existing master subject instead of creating one. */
  existing_subject_id?: number | null;
  /** Ignored by the server (kept so the old form object can be passed as-is). */
  school_id?: string | null;
  /** Classes of the caller's school to offer the subject in. */
  class_ids?: string[];
  teacher_assignments?: CreateSubjectTeacherAssignment[];
  subject_name?: string | null; // max 120
  subject_code?: string | null; // max 32
  acronym?: string | null; // max 3
  short_name?: string | null; // max 60
  strapline?: string | null; // max 120
  description?: string | null; // max 2000
  department?: string | null; // max 80
  category?: SubjectCategory | string | null; // default "core"
  subject_type?: SubjectType | string | null; // default "general"
  education_level?: EducationLevel | string | null; // default "secondary"
  requires_lab?: boolean;
  has_coursework?: boolean; // default true
  has_assessments?: boolean; // default true
  is_elective?: boolean;
  is_active?: boolean; // default true
  default_sequence?: number | null;
  theme_token?: string | null;
  /** A bundled "/abstract/..." image or a full https:// URL. Prefer uploading `backgroundImage`. */
  abstract_image_url?: string | null;
};

export type CreateSubjectInput = {
  payload: CreateSubjectPayload;
  /** Optional background. JPEG/PNG/WebP/GIF/AVIF, max SUBJECT_BACKGROUND_MAX_BYTES (8 MB). */
  backgroundImage?: File | null;
};

export type CreateAssessmentInput = {
  /** cat | exam | rat | quiz (required). */
  type: AssessmentType | string;
  /** Required, max 200. */
  title: string;
  /** Class ids (SubjectDetailPayload.classPerformance[].classId) offered for this subject; at least one. */
  target_class_ids: string[];
  description?: string | null;
  term?: string | null;
  /** 0 / null / "" mean "not set". Max 9999.99. */
  total_marks_raw?: number | null;
  /** Whole minutes, 0 / null mean "not set". Max 10080. */
  duration_minutes?: number | null;
  /** datetime-local strings ("2026-09-30T09:00") or ISO; the end can't be before the start. */
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  /** A teacher of this school. */
  teacher_id?: string | null;
};

export type CreateTopicInput = {
  /** SubjectCourseworkPayload.classOfferings[].id */
  school_subject_class_id: string;
  title: string; // required, max 200
  node_type?: CurriculumNodeType | string; // default "topic"
  /** Whole number >= 0. Default 0. */
  sort_order?: number;
  /** A node id from the SAME class offering's tree. */
  parent_id?: string | null;
};

export type CreateResourceInput = {
  /** SubjectCourseworkPayload.classOfferings[].id */
  school_subject_class_id: string;
  title: string; // required, max 200
  resource_type?: ResourceType | string; // default "document"
  visibility?: ResourceVisibility | string; // default "private"
  /** A node id from the SAME class offering's tree. */
  curriculum_node_id?: string | null;
  short_description?: string | null; // max 1000
  author_name?: string | null; // max 120
  /** Full https:// link or a same-site path. */
  cover_image_url?: string | null;
  /** http(s) links only (javascript:/data: are rejected). A file OR a source_url is required. */
  source_url?: string | null;
  /** Max SUBJECT_RESOURCE_MAX_BYTES (20 MB); types in SUBJECT_RESOURCE_ACCEPT. */
  file?: File | null;
};

export type UpdateProgressInput = {
  /** SubjectCourseworkPayload.classOfferings[].id */
  school_subject_class_id: string;
  /** A node id from that class offering's tree, or null for "no current topic". */
  current_node_id?: string | null;
  /** 0-100. */
  syllabus_progress_pct?: number | null;
};

export type ToggleVisibilityInput = {
  resource_id: string;
  next_visibility: ResourceVisibility;
};

// ---------------------------------------------------------------------------
// Constants the UI can reuse
// ---------------------------------------------------------------------------

export {
  SUBJECT_BACKGROUND_ACCEPT,
  SUBJECT_BACKGROUND_MAX_BYTES,
  SUBJECT_RESOURCE_ACCEPT,
  SUBJECT_RESOURCE_MAX_BYTES,
} from "@/lib/subjects";

/** HttpError.code values these endpoints add on top of BAD_REQUEST / FORBIDDEN / UNAUTHORIZED / RATE_LIMITED / INTERNAL. */
export const SUBJECT_ERROR_CODES = {
  /** 404 - subject offering missing, malformed, or another school's. */
  subjectNotFound: "SUBJECT_NOT_FOUND",
  /** 404 - class offering isn't part of this subject. */
  classNotFound: "SUBJECT_CLASS_NOT_FOUND",
  /** 404 - resource isn't part of this subject. */
  resourceNotFound: "SUBJECT_RESOURCE_NOT_FOUND",
  /** 409 - a subject with that name/code already exists. */
  duplicate: "SUBJECT_DUPLICATE",
  /** 409 - the master subject is shared with other schools, so its background can't be changed. */
  shared: "SUBJECT_SHARED",
  /** 400 - background image type/size rejected. */
  imageInvalid: "SUBJECT_IMAGE_INVALID",
  /** 400 - parent/current/linked topic isn't part of the chosen class. */
  topicInvalid: "SUBJECT_TOPIC_INVALID",
  /** 400 - chosen teacher isn't in this school. */
  assessmentTeacherInvalid: "ASSESSMENT_TEACHER_INVALID",
  /** 400 - none of the chosen classes is offered for this subject. */
  assessmentTargetsInvalid: "ASSESSMENT_TARGETS_INVALID",
  /** 400 - a resource needs a file or a source_url. */
  resourceSourceRequired: "RESOURCE_SOURCE_REQUIRED",
  /** 400 - resource file type/size rejected. */
  resourceFileInvalid: "RESOURCE_FILE_INVALID",
} as const;

// ---------------------------------------------------------------------------
// Query keys. Sub-keys live here (keys.ts is shared); all sit under qk.subjects.all.
// ---------------------------------------------------------------------------

export const subjectKeys = {
  all: qk.subjects.all,
  list: () => qk.subjects.list(),
  detail: (id: string) => qk.subjects.detail(id),
  assessments: (id: string) => [...qk.subjects.all, "assessments", id] as const,
  coursework: (id: string, classOfferingId?: string | null) =>
    [...qk.subjects.all, "coursework", id, classOfferingId ?? "all"] as const,
};

const STALE_MS = 30_000; // 30 s: fresh enough for a live dashboard, cheap enough to not refetch on every render

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * GET /api/subjects — the school's subject directory.
 * Key: qk.subjects.list(). Data: SubjectDirectoryPayload { cards, options }.
 * Why: powers the Subjects catalog (cards, filters, form option lists).
 */
export function useSubjects() {
  return useQuery({
    queryKey: subjectKeys.list(),
    queryFn: async ({ signal }) =>
      (await apiGet<SubjectsEnvelope<SubjectDirectoryPayload>>("/api/subjects", signal)).data,
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * GET /api/subjects/[id] — one subject offering's detail.
 * Key: qk.subjects.detail(id). Data: SubjectDetailPayload. 404 (SUBJECT_NOT_FOUND) for
 * an id that doesn't exist or isn't this school's. Disabled until `id` is set.
 */
export function useSubject(id: string | null | undefined) {
  return useQuery({
    queryKey: subjectKeys.detail(id ?? ""),
    queryFn: async ({ signal }) =>
      (await apiGet<SubjectsEnvelope<SubjectDetailPayload>>(`/api/subjects/${id}`, signal)).data,
    enabled: Boolean(id),
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * GET /api/subjects/[id]/assessments — upcoming + past assessments.
 * Key: [...qk.subjects.all, "assessments", id]. Data: SubjectAssessmentsPayload.
 */
export function useSubjectAssessments(id: string | null | undefined) {
  return useQuery({
    queryKey: subjectKeys.assessments(id ?? ""),
    queryFn: async ({ signal }) =>
      (await apiGet<SubjectsEnvelope<SubjectAssessmentsPayload>>(`/api/subjects/${id}/assessments`, signal)).data,
    enabled: Boolean(id),
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * GET /api/subjects/[id]/coursework[?class_offering_id=...] — class offerings, progress,
 * curriculum trees and resources.
 * Key: [...qk.subjects.all, "coursework", id, classOfferingId ?? "all"].
 * Data: SubjectCourseworkPayload. Without `classOfferingId` (what the old page did) the
 * payload carries every class's tree; with it (a SubjectCourseworkClassOption.id) only
 * that class's tree + resources are returned, while classOfferings still lists all classes.
 */
export function useSubjectCoursework(id: string | null | undefined, classOfferingId?: string | null) {
  return useQuery({
    queryKey: subjectKeys.coursework(id ?? "", classOfferingId),
    queryFn: async ({ signal }) => {
      const suffix = classOfferingId ? `?class_offering_id=${encodeURIComponent(classOfferingId)}` : "";
      return (
        await apiGet<SubjectsEnvelope<SubjectCourseworkPayload>>(`/api/subjects/${id}/coursework${suffix}`, signal)
      ).data;
    },
    enabled: Boolean(id),
    staleTime: STALE_MS,
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * POST /api/subjects — create a subject offering (multipart, exactly like the old
 * slide-over: a `payload` JSON field plus an optional `background_image` file).
 * Invalidates qk.subjects.all. Resolves with CreateSubjectResult.
 * Errors: 400 validation / SUBJECT_IMAGE_INVALID, 404 unknown existing subject,
 * 409 SUBJECT_DUPLICATE | SUBJECT_SHARED.
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, backgroundImage }: CreateSubjectInput) => {
      const form = new FormData();
      form.set("payload", JSON.stringify(payload));
      if (backgroundImage) form.set("background_image", backgroundImage);
      return (await apiSendForm<SubjectsEnvelope<CreateSubjectResult>>("POST", "/api/subjects", form)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.subjects.all }),
  });
}

/**
 * POST /api/subjects/[id]/assessments — schedule an assessment (JSON).
 * Invalidates qk.subjects.all. Resolves with the refreshed SubjectAssessmentsPayload.
 * Errors: 400 "Assessment title, type, and target classes are required." | validation |
 * ASSESSMENT_TARGETS_INVALID | ASSESSMENT_TEACHER_INVALID, 404 SUBJECT_NOT_FOUND.
 */
export function useCreateAssessment(subjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssessmentInput) =>
      (await apiSend<SubjectsEnvelope<SubjectAssessmentsPayload>>("POST", `/api/subjects/${subjectId}/assessments`, input))
        .data,
    onSuccess: (data) => {
      queryClient.setQueryData(subjectKeys.assessments(subjectId), data);
      return queryClient.invalidateQueries({ queryKey: qk.subjects.all });
    },
  });
}

/** Shared onSuccess for the coursework mutations: show the fresh tree at once, then refetch every variant. */
function useCourseworkRefresh(subjectId: string) {
  const queryClient = useQueryClient();
  return (data: SubjectCourseworkPayload) => {
    queryClient.setQueryData(subjectKeys.coursework(subjectId), data);
    return queryClient.invalidateQueries({ queryKey: qk.subjects.all });
  };
}

/**
 * POST /api/subjects/[id]/coursework, action=create_topic (multipart form, like the old page).
 * Invalidates qk.subjects.all. Resolves with the refreshed SubjectCourseworkPayload.
 * Errors: 400 "Class offering and topic title are required." | SUBJECT_TOPIC_INVALID,
 * 404 SUBJECT_CLASS_NOT_FOUND.
 */
export function useCreateTopic(subjectId: string) {
  const refresh = useCourseworkRefresh(subjectId);
  return useMutation({
    mutationFn: async (input: CreateTopicInput) => {
      const form = new FormData();
      form.set("action", "create_topic");
      form.set("school_subject_class_id", input.school_subject_class_id);
      form.set("title", input.title);
      form.set("node_type", input.node_type ?? "topic");
      form.set("sort_order", String(input.sort_order ?? 0));
      if (input.parent_id) form.set("parent_id", input.parent_id);
      return (
        await apiSendForm<SubjectsEnvelope<SubjectCourseworkPayload>>(
          "POST",
          `/api/subjects/${subjectId}/coursework`,
          form,
        )
      ).data;
    },
    onSuccess: refresh,
  });
}

/**
 * POST /api/subjects/[id]/coursework, action=create_resource (multipart, optional file).
 * Invalidates qk.subjects.all. Resolves with the refreshed SubjectCourseworkPayload.
 * Errors: 400 "Class offering and resource title are required." | RESOURCE_SOURCE_REQUIRED |
 * RESOURCE_FILE_INVALID | SUBJECT_TOPIC_INVALID, 404 SUBJECT_CLASS_NOT_FOUND.
 */
export function useCreateResource(subjectId: string) {
  const refresh = useCourseworkRefresh(subjectId);
  return useMutation({
    mutationFn: async (input: CreateResourceInput) => {
      const form = new FormData();
      form.set("action", "create_resource");
      form.set("school_subject_class_id", input.school_subject_class_id);
      form.set("title", input.title);
      form.set("resource_type", input.resource_type ?? "document");
      form.set("visibility", input.visibility ?? "private");
      form.set("short_description", input.short_description ?? "");
      form.set("author_name", input.author_name ?? "");
      form.set("cover_image_url", input.cover_image_url ?? "");
      form.set("source_url", input.source_url ?? "");
      if (input.curriculum_node_id) form.set("curriculum_node_id", input.curriculum_node_id);
      if (input.file) form.set("file", input.file);
      return (
        await apiSendForm<SubjectsEnvelope<SubjectCourseworkPayload>>(
          "POST",
          `/api/subjects/${subjectId}/coursework`,
          form,
        )
      ).data;
    },
    onSuccess: refresh,
  });
}

/**
 * PATCH /api/subjects/[id]/coursework, action=update_progress (JSON): current topic + % covered.
 * Invalidates qk.subjects.all. Resolves with the refreshed SubjectCourseworkPayload.
 * Errors: 400 validation (0-100) | SUBJECT_TOPIC_INVALID, 404 SUBJECT_CLASS_NOT_FOUND.
 */
export function useUpdateProgress(subjectId: string) {
  const refresh = useCourseworkRefresh(subjectId);
  return useMutation({
    mutationFn: async (input: UpdateProgressInput) =>
      (
        await apiSend<SubjectsEnvelope<SubjectCourseworkPayload>>("PATCH", `/api/subjects/${subjectId}/coursework`, {
          action: "update_progress",
          school_subject_class_id: input.school_subject_class_id,
          current_node_id: input.current_node_id ?? null,
          syllabus_progress_pct: input.syllabus_progress_pct ?? null,
        })
      ).data,
    onSuccess: refresh,
  });
}

/**
 * PATCH /api/subjects/[id]/coursework, action=toggle_visibility (JSON): private <-> public.
 * The server records the change in the visibility history. Invalidates qk.subjects.all.
 * Resolves with the refreshed SubjectCourseworkPayload. Errors: 404 SUBJECT_RESOURCE_NOT_FOUND.
 */
export function useToggleResourceVisibility(subjectId: string) {
  const refresh = useCourseworkRefresh(subjectId);
  return useMutation({
    mutationFn: async (input: ToggleVisibilityInput) =>
      (
        await apiSend<SubjectsEnvelope<SubjectCourseworkPayload>>("PATCH", `/api/subjects/${subjectId}/coursework`, {
          action: "toggle_visibility",
          resource_id: input.resource_id,
          next_visibility: input.next_visibility,
        })
      ).data,
    onSuccess: refresh,
  });
}
