// =============================================================================
// useSchools - the data layer for the admin "Schools" page (/dashboard/schools).
// -----------------------------------------------------------------------------
// One place that talks to /api/school*, so no page or component ever calls
// fetch() by hand. It exposes:
//   Queries    useSchools()                       GET    /api/school
//              useSchool(id)                      GET    /api/school/[id]
//   Mutations  useCreateSchool()                  POST   /api/school
//              useUpdateSchool()                  PATCH  /api/school/[id]
//              useSchoolAction()                  POST   /api/school/[id]/actions
//              useDeleteSchool()                  DELETE /api/school/[id]      (super-admin)
//              useUploadSchoolLogo()              POST   /api/school/logo      (multipart)
//              useDownloadSchoolSecurityCodes()   GET    /api/school/[id]/security-codes (super-admin, PDF)
//
// Every mutation that changes a school invalidates qk.schools.all, so the list
// and any open detail drawer refresh on their own.
//
// SECURITY CODES: the server answers that route with a PDF (never JSON), so the
// codes are NOT held in any query cache or store. The mutation streams the blob
// into a browser download and revokes the object URL again; nothing is kept.
// (A "reveal on click" UI would need a JSON variant of that route - see the
// API-gap note in the lane report.)
// =============================================================================

"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiGet, apiSend, apiSendForm, HttpError } from "@/lib/api/http";
import { qk } from "@/lib/query/keys";

/* ---------------------------------------------------------------- types --- */

export type SchoolStatus = "active" | "pending" | "suspended";
export type SubscriptionStatus = "inactive" | "active" | "expired" | "suspended" | "trial";

/** One row of the `school_usage_overview` view, as GET /api/school returns it. */
export type SchoolRow = {
  id: string;
  school_id: number;
  name: string;
  code: string;
  logo: string | null;
  email: string | null;
  phone_1: string | null;
  head_name: string | null;
  owner_name: string | null;
  status: SchoolStatus;
  subscription_package: string;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;

  expected_users: number;
  expected_teachers: number;
  expected_admins: number;
  expected_students: number;
  expected_parents: number;
  expected_staff: number;

  no_of_users: number;
  no_of_teachers: number;
  no_of_admins: number;
  no_of_students: number;
  no_of_parents: number;
  no_of_staff: number;

  code_change_count: number;
  pending_code_change_at: string | null;
  pending_status_change_at: string | null;
};

/** GET /api/school/[id]: the same row plus the profile fields the edit form needs. */
export type SchoolDetails = SchoolRow & {
  phone_2?: string | null;
  phone_3?: string | null;
  location?: string | null;
};

export type SchoolsResponse = { data: SchoolRow[] };
export type SchoolResponse = { data: SchoolDetails };

/** POST /api/school body. Numbers are already numbers; empty text stays "". */
export type CreateSchoolInput = {
  name: string;
  email: string;
  phone_1: string;
  phone_2: string;
  phone_3: string;
  head_name: string;
  owner_name: string;
  location: string;
  logo: string;
  subscription_package: string;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string;
  subscription_expires_at: string;
  expected_users: number;
  expected_students: number;
  expected_parents: number;
  expected_teachers: number;
  expected_admins: number;
  expected_staff: number;
};

export type CreateSchoolResponse = {
  ok: true;
  data: {
    id: string;
    school_id: number;
    name: string;
    code: string;
    email: string;
    status: SchoolStatus;
  };
  message: string;
};

/**
 * PATCH /api/school/[id] body. The route writes phone_2 / phone_3 as `null`
 * whenever they are missing from the body, so the edit form always sends all
 * of these fields.
 */
export type UpdateSchoolInput = {
  name: string;
  head_name: string | null;
  owner_name: string | null;
  email: string | null;
  phone_1: string | null;
  phone_2: string | null;
  phone_3: string | null;
  location: string | null;
  logo: string | null;
  status: SchoolStatus;
  subscription_package: string;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
};

export type SchoolActionType = "activate" | "suspend" | "increase_capacity_50" | "regenerate_code";
export type SchoolActionResponse = { ok: true; message?: string };

export type UploadSchoolLogoResponse = { ok: true; data: { path: string; url: string } };

/* ------------------------------------------------------------- helpers --- */

/** Retrying a 401 / 403 / 404 will not change the answer, so fail fast. */
const NO_RETRY = [401, 403, 404];

function retryPolicy(failureCount: number, error: unknown) {
  if (error instanceof HttpError && NO_RETRY.includes(error.status)) return false;
  return failureCount < 1;
}

const invalidateSchools = (qc: QueryClient) => qc.invalidateQueries({ queryKey: qk.schools.all });

/* -------------------------------------------------------------- queries --- */

/**
 * All schools the caller may see. Kept fresh for 30 s and re-fetched when the
 * tab regains focus, like the other admin lists.
 */
export function useSchools() {
  return useQuery({
    queryKey: qk.schools.list(),
    queryFn: ({ signal }) => apiGet<SchoolsResponse>("/api/school", signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryPolicy,
  });
}

/**
 * One school with its profile fields. While the request is in flight the
 * matching row from the list cache is shown as placeholder data (check
 * `isPlaceholderData` before trusting phone_2 / phone_3 / location).
 */
export function useSchool(id: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery<SchoolResponse>({
    queryKey: qk.schools.detail(id ?? ""),
    queryFn: ({ signal }) => apiGet<SchoolResponse>(`/api/school/${encodeURIComponent(id ?? "")}`, signal),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: retryPolicy,
    placeholderData: () => {
      const row = qc.getQueryData<SchoolsResponse>(qk.schools.list())?.data.find((school) => school.id === id);
      return row ? { data: row } : undefined;
    },
  });
}

/* ------------------------------------------------------------ mutations --- */

export function useCreateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSchoolInput) => apiSend<CreateSchoolResponse>("POST", "/api/school", input),
    onSuccess: () => invalidateSchools(qc),
  });
}

export function useUpdateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSchoolInput }) =>
      apiSend<{ ok: true }>("PATCH", `/api/school/${encodeURIComponent(id)}`, input),
    onSuccess: () => invalidateSchools(qc),
  });
}

/** activate | suspend | increase_capacity_50 | regenerate_code. */
export function useSchoolAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: SchoolActionType }) =>
      apiSend<SchoolActionResponse>("POST", `/api/school/${encodeURIComponent(id)}/actions`, { action }),
    onSuccess: () => invalidateSchools(qc),
  });
}

/** Super-admin only (the server enforces it). */
export function useDeleteSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend<{ ok: true }>("DELETE", `/api/school/${encodeURIComponent(id)}`),
    onSuccess: (_data, id) => {
      // Do not refetch the detail of the school that no longer exists (the open
      // drawer would show a "not found" error just before it closes).
      const isDeletedDetail = (key: readonly unknown[]) => key[1] === "detail" && key[2] === id;
      return qc.invalidateQueries({
        queryKey: qk.schools.all,
        predicate: (query) => !isDeletedDetail(query.queryKey),
      });
    },
  });
}

/**
 * Uploads a logo through the server route (multipart) and resolves with its
 * public URL. It does not touch a school record, so nothing is invalidated;
 * the URL is saved with the create / update mutation.
 */
export function useUploadSchoolLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiSendForm<UploadSchoolLogoResponse>("POST", "/api/school/logo", form);
      const url = String(res?.data?.url ?? "");
      if (!url) throw new Error("Logo upload did not return a usable URL.");
      return url;
    },
  });
}

/** "Bright Future Academy" -> "bright-future-academy" (same rule the old page used). */
function fileSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "school";
}

/**
 * Downloads the school's security-codes PDF (super-admin only; the server
 * enforces it). The PDF is turned into a short-lived object URL that is
 * revoked after the browser has started the download - nothing is cached.
 */
export function useDownloadSchoolSecurityCodes() {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/school/${encodeURIComponent(id)}/security-codes`, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!res.ok) {
        // The route answers errors with JSON `{ error }` even though success is a PDF.
        const body = await res.json().catch(() => null);
        throw new HttpError(res.status, body?.error ?? `Request failed (${res.status})`, body?.code);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileSlug(name)}-security-codes.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    },
  });
}
