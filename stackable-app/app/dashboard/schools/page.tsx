"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useToast } from "@/components/toast/ToastProvider";
import {
  useConfirmation,
  type ConfirmationRequestOptions,
} from "@/components/confirmation/ConfirmationProvider";

type ViewMode = "list" | "grid";
type SchoolStatus = "active" | "pending" | "suspended";
type SubscriptionStatus = "inactive" | "active" | "expired" | "suspended" | "trial";

type SchoolRow = {
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

type SchoolDetails = SchoolRow & {
  phone_2?: string | null;
  phone_3?: string | null;
  location?: string | null;
};

type SchoolCreateForm = {
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
  expected_users: string;
  expected_students: string;
  expected_parents: string;
  expected_teachers: string;
  expected_admins: string;
  expected_staff: string;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function createInitialSchoolForm(): SchoolCreateForm {
  return {
    name: "",
    email: "",
    phone_1: "",
    phone_2: "",
    phone_3: "",
    head_name: "",
    owner_name: "",
    location: "",
    logo: "",
    subscription_package: "Seedling",
    subscription_status: "trial",
    subscription_started_at: new Date().toISOString().slice(0, 10),
    subscription_expires_at: "",
    expected_users: "50",
    expected_students: "10",
    expected_parents: "10",
    expected_teachers: "10",
    expected_admins: "10",
    expected_staff: "10",
  };
}

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "SC";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function schoolStatusClasses(status: SchoolStatus) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function subscriptionStatusClasses(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "trial":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "expired":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    case "inactive":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function toPercent(actual: number, expected: number) {
  if (!expected || expected <= 0) return 0;
  return (actual / expected) * 100;
}

function capacityTextClass(actual: number, expected: number) {
  if (!expected || expected <= 0) return "text-gray-400";
  const pct = toPercent(actual, expected);

  if (pct <= 50) return "text-green-700";
  if (pct <= 70) return "text-gray-900";
  if (pct <= 85) return "text-yellow-600";
  if (pct <= 90) return "text-orange-600";
  return "text-red-600";
}

function capacityWarning(actual: number, expected: number) {
  if (!expected || expected <= 0) return false;
  return toPercent(actual, expected) > 90;
}

function CapacityCell({
  actual,
  expected,
}: {
  actual: number;
  expected: number;
}) {
  const warn = capacityWarning(actual, expected);
  const pct = Math.round(toPercent(actual, expected));

  return (
    <div className={`font-semibold ${capacityTextClass(actual, expected)}`}>
      <span className="inline-flex items-center gap-1">
        {warn ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        ) : null}
        <span>{actual}</span>
      </span>
      <div className="hidden text-[11px] font-medium text-gray-400">
        / {expected} · {pct}%
      </div>
    </div>
  );
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
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">No schools found</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
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

  return renderPagination();
}

export default function SchoolsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirmation();

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [selectedSchool, setSelectedSchool] = useState<SchoolDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SchoolCreateForm>(
    createInitialSchoolForm(),
  );
  const [creating, setCreating] = useState(false);
  const [uploadingLogoTarget, setUploadingLogoTarget] = useState<
    "create" | "edit" | null
  >(null);

  const createLogoInputRef = useRef<HTMLInputElement | null>(null);
  const editLogoInputRef = useRef<HTMLInputElement | null>(null);

  const showErrorToast = useCallback(
    (title: string, description?: string) => {
      showToast({ type: "error", title, description });
    },
    [showToast],
  );

  const showSuccessToast = useCallback(
    (title: string, description?: string) => {
      showToast({ type: "success", title, description });
    },
    [showToast],
  );

  const confirmAndRun = useCallback(
    async (
      options: ConfirmationRequestOptions,
      action: () => Promise<void> | void,
    ) => {
      const accepted = await confirm(options);
      if (!accepted) return;

      try {
        await action();
      } catch (error) {
        console.error(error);
        showErrorToast(
          "Action failed",
          error instanceof Error ? error.message : "Something went wrong.",
        );
      }
    },
    [confirm, showErrorToast],
  );

  const getErrorMessage = useCallback(
    async (res: Response, fallback: string) => {
      try {
        const data = await res.json();
        return data?.error || data?.message || fallback;
      } catch {
        return fallback;
      }
    },
    [],
  );

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/school", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to fetch schools."));
      }
      const data = await res.json();
      setSchools(data.data ?? []);
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Schools load failed",
        error instanceof Error ? error.message : "Failed to fetch schools.",
      );
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage, showErrorToast]);

  useEffect(() => {
    void fetchSchools();
  }, [fetchSchools]);

  const packageOptions = useMemo(() => {
    return Array.from(new Set(schools.map((item) => item.subscription_package))).sort();
  }, [schools]);

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();

    let data = schools.filter((school) => {
      const matchesSearch =
        !q ||
        school.name.toLowerCase().includes(q) ||
        school.code.toLowerCase().includes(q) ||
        (school.email ?? "").toLowerCase().includes(q) ||
        (school.phone_1 ?? "").toLowerCase().includes(q) ||
        (school.head_name ?? "").toLowerCase().includes(q) ||
        (school.owner_name ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || school.status === statusFilter;

      const matchesSubscription =
        subscriptionFilter === "all" ||
        school.subscription_status === subscriptionFilter;

      const matchesPackage =
        packageFilter === "all" ||
        school.subscription_package === packageFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSubscription &&
        matchesPackage
      );
    });

    data = [...data].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "users-high":
          return b.no_of_users - a.no_of_users;
        case "users-low":
          return a.no_of_users - b.no_of_users;
        case "expiry-asc":
          return (a.subscription_expires_at ?? "").localeCompare(
            b.subscription_expires_at ?? "",
          );
        case "expiry-desc":
          return (b.subscription_expires_at ?? "").localeCompare(
            a.subscription_expires_at ?? "",
          );
        default:
          return 0;
      }
    });

    return data;
  }, [schools, search, statusFilter, subscriptionFilter, packageFilter, sortBy]);

  const totalEntries = filteredSchools.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, subscriptionFilter, packageFilter, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedSchools = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSchools.slice(start, start + pageSize);
  }, [filteredSchools, page, pageSize]);

  const pageStart = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalEntries);

  function openCreatePanel() {
    setCreateForm(createInitialSchoolForm());
    setCreateOpen(true);
    setDetailsOpen(false);
    setSelectedSchool(null);
  }

  function closeCreatePanel() {
    if (creating || uploadingLogoTarget === "create") return;
    setCreateOpen(false);
  }

  async function openDetails(id: string) {
    if (!id) {
      console.error("Missing school id:", id);
      showErrorToast(
        "Missing school id",
        "This school record has no id. Fix the school_usage_overview view.",
      );
      return;
    }

    try {
      const res = await fetch(`/api/school/${id}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to fetch school details."),
        );
      }
      const data = await res.json();
      setSelectedSchool(data.data);
      setDetailsOpen(true);
      setCreateOpen(false);
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Details load failed",
        error instanceof Error ? error.message : "Failed to load school details.",
      );
    }
  }

  async function performDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/school/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to delete school."));
      }

      setSchools((prev) => prev.filter((item) => item.id !== id));
      if (selectedSchool?.id === id) {
        setSelectedSchool(null);
        setDetailsOpen(false);
      }
      showSuccessToast("School deleted", "The school record was removed.");
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Delete failed",
        error instanceof Error ? error.message : "Failed to delete school.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function performSuspendActivate(school: SchoolRow) {
    const action = school.status === "suspended" ? "activate" : "suspend";
    setBusyId(school.id);

    try {
      const res = await fetch(`/api/school/${school.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to update school status."),
        );
      }
      await fetchSchools();
      showSuccessToast(
        action === "suspend" ? "School suspended" : "School activated",
        action === "suspend"
          ? "The school status update has been queued."
          : "The school is now active.",
      );
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Status update failed",
        error instanceof Error
          ? error.message
          : "Failed to update school status.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function performIncreaseUsers(id: string) {
    setBusyId(id);

    try {
      const res = await fetch(`/api/school/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "increase_capacity_50" }),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to increase school capacity."),
        );
      }
      await fetchSchools();

      if (selectedSchool?.id === id) {
        await openDetails(id);
      }
      showSuccessToast(
        "Capacity updated",
        "The school capacity increased by 50 users.",
      );
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Capacity update failed",
        error instanceof Error ? error.message : "Failed to increase users.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function performRegenerateCode(id: string) {
    setBusyId(id);

    try {
      const res = await fetch(`/api/school/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_code" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to queue school code regeneration",
        );
      }

      await fetchSchools();

      if (selectedSchool?.id === id) {
        await openDetails(id);
      }
      showSuccessToast(
        "Code regeneration queued",
        data?.message || "The school code update was queued successfully.",
      );
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Code regeneration failed",
        error instanceof Error
          ? error.message
          : "Failed to queue code regeneration.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownloadSecurityCodes(id: string, name: string) {
    setBusyId(id);

    try {
      const res = await fetch(`/api/school/${id}/security-codes`);
      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to download security codes."),
        );
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-security-codes.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccessToast(
        "PDF downloaded",
        "Your school security codes PDF has been downloaded.",
      );
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Download failed",
        error instanceof Error
          ? error.message
          : "Failed to download security codes.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function uploadLogo(file: File, target: "create" | "edit") {
    setUploadingLogoTarget(target);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/school/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to upload logo."));
      }

      const data = await res.json();
      const logoUrl = String(data?.data?.url ?? "");

      if (!logoUrl) {
        throw new Error("Logo upload did not return a usable URL.");
      }

      if (target === "create") {
        setCreateForm((prev) => ({ ...prev, logo: logoUrl }));
      } else {
        setSelectedSchool((prev) => (prev ? { ...prev, logo: logoUrl } : prev));
      }

      showSuccessToast("Logo uploaded", "School logo uploaded successfully.");
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Logo upload failed",
        error instanceof Error ? error.message : "Failed to upload logo.",
      );
    } finally {
      setUploadingLogoTarget(null);

      if (target === "create" && createLogoInputRef.current) {
        createLogoInputRef.current.value = "";
      }

      if (target === "edit" && editLogoInputRef.current) {
        editLogoInputRef.current.value = "";
      }
    }
  }

  async function performCreateSchool() {
    setCreating(true);

    try {
      if (!createForm.name.trim() || !createForm.email.trim() || !createForm.phone_1.trim()) {
        throw new Error("School name, school email, and primary phone are required.");
      }

      const res = await fetch("/api/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          expected_users: Number(createForm.expected_users || 0),
          expected_students: Number(createForm.expected_students || 0),
          expected_parents: Number(createForm.expected_parents || 0),
          expected_teachers: Number(createForm.expected_teachers || 0),
          expected_admins: Number(createForm.expected_admins || 0),
          expected_staff: Number(createForm.expected_staff || 0),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to create school.");
      }

      await fetchSchools();
      setCreateOpen(false);
      setCreateForm(createInitialSchoolForm());

      showSuccessToast(
        "School created",
        "The school was created and the confirmation email was sent.",
      );

      const shouldDownloadCodes = await confirm({
        title: "School created successfully",
        message: `${data?.data?.name ?? "The school"} was created with pending status. A confirmation email was sent to ${data?.data?.email ?? "the school email"}. Download the security codes PDF and keep it safely.`,
        confirmLabel: "Download PDF",
        cancelLabel: "Close",
        tone: "success",
        variant: "success",
      });

      if (shouldDownloadCodes) {
        await handleDownloadSecurityCodes(
          String(data?.data?.id ?? ""),
          String(data?.data?.name ?? "school"),
        );
      }
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Create school failed",
        error instanceof Error ? error.message : "Failed to create school.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function performSaveDetails() {
    if (!selectedSchool) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/school/${selectedSchool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedSchool.name,
          head_name: selectedSchool.head_name,
          owner_name: selectedSchool.owner_name,
          email: selectedSchool.email,
          phone_1: selectedSchool.phone_1,
          phone_2: selectedSchool.phone_2,
          phone_3: selectedSchool.phone_3,
          location: selectedSchool.location,
          logo: selectedSchool.logo,
          status: selectedSchool.status,
          subscription_package: selectedSchool.subscription_package,
          subscription_status: selectedSchool.subscription_status,
          subscription_started_at: selectedSchool.subscription_started_at,
          subscription_expires_at: selectedSchool.subscription_expires_at,
        }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update school."));
      }
      await fetchSchools();
      await openDetails(selectedSchool.id);
      showSuccessToast(
        "School updated",
        "The school changes were saved successfully.",
      );
    } catch (error) {
      console.error(error);
      showErrorToast(
        "Save failed",
        error instanceof Error ? error.message : "Failed to save school details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-transparent pl-5 pr-5 pb-6">
      <div className="w-full rounded-none p-5 -mb-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-gray-900">
              Schools
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              School portfolio, subscription health, capacity utilization, and high-risk actions.
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

            <button
              type="button"
              onClick={openCreatePanel}
              className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-[#d88915]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
              Add School
            </button>
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
                  placeholder="Search school, head, owner, code, email or phone"
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-700 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                School status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Subscription status
              </label>
              <select
                value={subscriptionFilter}
                onChange={(e) => setSubscriptionFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Package
              </label>
              <select
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All packages</option>
                {packageOptions.map((pkg) => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
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
                <option value="users-high">Users high</option>
                <option value="users-low">Users low</option>
                <option value="expiry-asc">Expiry nearest</option>
                <option value="expiry-desc">Expiry farthest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        {loading ? (
          <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
            <p className="mt-4 text-sm text-gray-500">Loading schools...</p>
          </div>
        ) : totalEntries === 0 ? (
          <EmptyState message="Your current filters returned no school records." />
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[2050px]">
                <thead className="bg-[#F8F8F8] text-left">
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="min-w-[360px] px-5 py-4">School</th>
                    <th className="px-5 py-4">Head / Owner</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Phone</th>
                    <th className="px-5 py-4">Package</th>
                    <th className="px-5 py-4">Users</th>
                    <th className="px-5 py-4">Students</th>
                    <th className="px-5 py-4">Parents</th>
                    <th className="px-5 py-4">Teachers</th>
                    <th className="px-5 py-4">Admins</th>
                    <th className="px-5 py-4">Staff</th>
                    <th className="min-w-[200px] px-5 py-4">School Code</th>
                    <th className="px-5 py-4">School Status</th>
                    <th className="px-5 py-4">Sub Status</th>
                    <th className="px-5 py-4">Expiry</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedSchools.map((school) => (
                    <tr
                      key={school.id}
                      className="border-t border-gray-100 text-sm text-gray-700 hover:bg-[#fffdf6]"
                    >
                      <td className="min-w-[360px] px-5 py-4">
                        <div className="flex items-center gap-3">
                          {school.logo ? (
                            <Image
                              src={school.logo}
                              alt={school.name}
                              width={44}
                              height={44}
                              className="h-11 w-11 rounded-full object-cover ring-2 ring-[#F7F9E2]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F9E2] text-sm font-semibold text-[#007146] ring-2 ring-[#F7F9E2]">
                              {getInitials(school.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openDetails(school.id)}
                              className="block max-w-[280px] text-left font-semibold text-gray-900 transition hover:text-[#F19F24] whitespace-normal break-words"
                            >
                              {school.name}
                            </button>
                            <div className="text-xs text-gray-500">
                              #{school.school_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{school.head_name || "—"}</div>
                          <div className="text-xs text-gray-500">{school.owner_name || "—"}</div>
                        </div>
                      </td>

                      <td className="px-5 py-4">{school.email || "—"}</td>
                      <td className="px-5 py-4">{school.phone_1 || "—"}</td>

                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {school.subscription_package}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(school.subscription_started_at)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_users} expected={school.expected_users} />
                      </td>
                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_students} expected={school.expected_students} />
                      </td>
                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_parents} expected={school.expected_parents} />
                      </td>
                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_teachers} expected={school.expected_teachers} />
                      </td>
                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_admins} expected={school.expected_admins} />
                      </td>
                      <td className="px-5 py-4">
                        <CapacityCell actual={school.no_of_staff} expected={school.expected_staff} />
                      </td>

                      <td className="min-w-[200px] px-5 py-4">
                        <div className="whitespace-nowrap font-semibold text-gray-900">{school.code}</div>
                        <div className="text-xs text-gray-500">
                          Changes: {school.code_change_count}/3
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${schoolStatusClasses(school.status)}`}>
                          {school.status}
                        </span>
                        {school.pending_status_change_at ? (
                          <div className="mt-1 text-[11px] text-amber-600">
                            queued {formatDate(school.pending_status_change_at)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${subscriptionStatusClasses(school.subscription_status)}`}>
                          {school.subscription_status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {formatDate(school.subscription_expires_at)}
                        </div>
                        {school.pending_code_change_at ? (
                          <div className="text-[11px] text-blue-600">
                            code queued {formatDate(school.pending_code_change_at)}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void confirmAndRun({
                                title:
                                  school.status === "suspended"
                                    ? "Activate school?"
                                    : "Suspend school?",
                                message:
                                  school.status === "suspended"
                                    ? `Activate ${school.name} now?`
                                    : `Suspend ${school.name}? This will queue the status update for this school.`,
                                confirmLabel:
                                  school.status === "suspended"
                                    ? "Activate"
                                    : "Suspend",
                                tone:
                                  school.status === "suspended"
                                    ? "primary"
                                    : "warning",
                              }, () => performSuspendActivate(school))
                            }
                            disabled={busyId === school.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                            title={school.status === "suspended" ? "Activate" : "Suspend"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
                              <path d="M8 7V5a4 4 0 1 1 8 0v2" />
                              <path d="M12 11v4" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => openDetails(school.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146] transition hover:scale-[1.02]"
                            title="View details"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void confirmAndRun({
                                title: "Increase school capacity?",
                                message: `Increase ${school.name} by 50 users and distribute the extra capacity across the school categories?`,
                                confirmLabel: "Increase capacity",
                                tone: "primary",
                              }, () => performIncreaseUsers(school.id))
                            }
                            disabled={busyId === school.id}
                            className=" hidden h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                            title="Increase users by 50"
                          >
                            +50 Users
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void confirmAndRun({
                                title: "Regenerate school code?",
                                message: `Queue a new code for ${school.name}? Each school only gets 3 code regeneration attempts.`,
                                confirmLabel: "Regenerate code",
                                tone: "warning",
                              }, () => performRegenerateCode(school.id))
                            }
                            disabled={busyId === school.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                            title="Queue code regeneration"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                              <path d="M21 3v6h-6" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDownloadSecurityCodes(school.id, school.name)}
                            disabled={busyId === school.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            title="Download security codes"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <path d="m7 10 5 5 5-5" />
                              <path d="M12 15V3" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void confirmAndRun({
                                title: "Delete school?",
                                message: `Delete ${school.name}? This action cannot be undone.`,
                                confirmLabel: "Delete school",
                                tone: "danger",
                              }, () => performDelete(school.id))
                            }
                            disabled={busyId === school.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
            {paginatedSchools.map((school) => (
              <div
                key={school.id}
                className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm transition hover:translate-y-[-2px] hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {school.logo ? (
                      <Image
                        src={school.logo}
                        alt={school.name}
                        width={54}
                        height={54}
                        className="h-[54px] w-[54px] rounded-full object-cover ring-2 ring-[#F7F9E2]"
                      />
                    ) : (
                      <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#F7F9E2] text-base font-semibold text-[#007146]">
                        {getInitials(school.name)}
                      </div>
                    )}

                    <div>
                      <button
                        type="button"
                        onClick={() => openDetails(school.id)}
                        className="text-base font-semibold text-gray-900 transition hover:text-[#F19F24]"
                      >
                        {school.name}
                      </button>
                      <p className="mt-1 text-xs text-gray-500">{school.code}</p>
                    </div>
                  </div>

                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${schoolStatusClasses(school.status)}`}>
                    {school.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Head</p>
                    <p className="mt-1 font-medium text-gray-800">{school.head_name || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Owner</p>
                    <p className="mt-1 font-medium text-gray-800">{school.owner_name || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Phone</p>
                    <p className="mt-1 font-medium text-gray-800">{school.phone_1 || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
                    <p className="mt-1 font-medium text-gray-800">{school.email || "—"}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Package</p>
                    <p className="mt-1 font-medium text-gray-800">{school.subscription_package}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Expiry</p>
                    <p className="mt-1 font-medium text-gray-800">{formatDate(school.subscription_expires_at)}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Users</p>
                    <CapacityCell actual={school.no_of_users} expected={school.expected_users} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Students</p>
                    <CapacityCell actual={school.no_of_students} expected={school.expected_students} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Parents</p>
                    <CapacityCell actual={school.no_of_parents} expected={school.expected_parents} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Teachers</p>
                    <CapacityCell actual={school.no_of_teachers} expected={school.expected_teachers} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Admins</p>
                    <CapacityCell actual={school.no_of_admins} expected={school.expected_admins} />
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Staff</p>
                    <CapacityCell actual={school.no_of_staff} expected={school.expected_staff} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void confirmAndRun({
                        title:
                          school.status === "suspended"
                            ? "Activate school?"
                            : "Suspend school?",
                        message:
                          school.status === "suspended"
                            ? `Activate ${school.name} now?`
                            : `Suspend ${school.name}? This will queue the status update for this school.`,
                        confirmLabel:
                          school.status === "suspended" ? "Activate" : "Suspend",
                        tone:
                          school.status === "suspended" ? "primary" : "warning",
                      }, () => performSuspendActivate(school))
                    }
                    disabled={busyId === school.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                    title={school.status === "suspended" ? "Activate" : "Suspend"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
                      <path d="M8 7V5a4 4 0 1 1 8 0v2" />
                      <path d="M12 11v4" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => openDetails(school.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dbe8cc] bg-[#F7F9E2] text-[#007146]"
                    title="View details"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void confirmAndRun({
                        title: "Increase school capacity?",
                        message: `Increase ${school.name} by 50 users and distribute the extra capacity across the school categories?`,
                        confirmLabel: "Increase capacity",
                        tone: "primary",
                      }, () => performIncreaseUsers(school.id))
                    }
                    disabled={busyId === school.id}
                    className="hidden h-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700"
                  >
                    +50 Users
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void confirmAndRun({
                        title: "Regenerate school code?",
                        message: `Queue a new code for ${school.name}? Each school only gets 3 code regeneration attempts.`,
                        confirmLabel: "Regenerate code",
                        tone: "warning",
                      }, () => performRegenerateCode(school.id))
                    }
                    disabled={busyId === school.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700"
                    title="Queue code regeneration"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDownloadSecurityCodes(school.id, school.name)}
                    disabled={busyId === school.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                    title="Download security codes"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <path d="m7 10 5 5 5-5" />
                      <path d="M12 15V3" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void confirmAndRun({
                        title: "Delete school?",
                        message: `Delete ${school.name}? This action cannot be undone.`,
                        confirmLabel: "Delete school",
                        tone: "danger",
                      }, () => performDelete(school.id))
                    }
                    disabled={busyId === school.id}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

            <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          </div>
        </div>
      </div>

      {detailsOpen && selectedSchool ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
            onClick={() => setDetailsOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[680px] overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">School Details</h2>
                  <p className="text-sm text-gray-500">
                    Edit school profile, subscription, status, and capacity controls.
                  </p>
                </div>
                <button
                  onClick={() => setDetailsOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="flex items-center gap-4">
                {selectedSchool.logo ? (
                  <Image
                    src={selectedSchool.logo}
                    alt={selectedSchool.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-full object-cover ring-4 ring-[#F7F9E2]"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#F7F9E2] text-lg font-semibold text-[#007146]">
                    {getInitials(selectedSchool.name)}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-xl font-bold text-gray-900">{selectedSchool.name}</div>
                  <div className="mt-1 text-sm text-gray-500">
                    Code: {selectedSchool.code}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">School Name</label>
                  <input
                    value={selectedSchool.name ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Head</label>
                  <input
                    value={selectedSchool.head_name ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, head_name: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Owner</label>
                  <input
                    value={selectedSchool.owner_name ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, owner_name: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Email</label>
                  <input
                    value={selectedSchool.email ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, email: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</label>
                  <input
                    value={selectedSchool.phone_1 ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, phone_1: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Logo URL</label>
                  <div className="flex gap-2">
                    <input
                      value={selectedSchool.logo ?? ""}
                      onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, logo: e.target.value } : prev)}
                      className="flex-1 rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => editLogoInputRef.current?.click()}
                      disabled={uploadingLogoTarget === "edit"}
                      className="rounded-[16px] border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-3 text-sm font-semibold text-[#007146] disabled:opacity-60"
                    >
                      {uploadingLogoTarget === "edit" ? "Uploading..." : "Upload"}
                    </button>
                    <input
                      ref={editLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadLogo(file, "edit");
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Phone 2</label>
                  <input
                    value={selectedSchool.phone_2 ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, phone_2: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Phone 3</label>
                  <input
                    value={selectedSchool.phone_3 ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, phone_3: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Location</label>
                  <input
                    value={selectedSchool.location ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, location: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">School Status</label>
                  <select
                    value={selectedSchool.status}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, status: e.target.value as SchoolStatus } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Package</label>
                  <select
                    value={selectedSchool.subscription_package}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, subscription_package: e.target.value } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  >
                    <option value="Seedling">Seedling</option>
<option value="Branch">Branch</option>
<option value="Canopy">Canopy</option>
<option value="Forest">Forest</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Status</label>
                  <select
                    value={selectedSchool.subscription_status}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, subscription_status: e.target.value as SubscriptionStatus } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  >
                    <option value="inactive">Inactive</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="suspended">Suspended</option>
                    <option value="trial">Trial</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Start</label>
                  <input
                    type="date"
                    value={selectedSchool.subscription_started_at?.slice(0, 10) ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, subscription_started_at: e.target.value || null } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Expiry</label>
                  <input
                    type="date"
                    value={selectedSchool.subscription_expires_at?.slice(0, 10) ?? ""}
                    onChange={(e) => setSelectedSchool((prev) => prev ? { ...prev, subscription_expires_at: e.target.value || null } : prev)}
                    className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-[24px] border border-gray-100 bg-[#fffdf8] p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Users</p>
                  <CapacityCell actual={selectedSchool.no_of_users} expected={selectedSchool.expected_users} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Students</p>
                  <CapacityCell actual={selectedSchool.no_of_students} expected={selectedSchool.expected_students} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Parents</p>
                  <CapacityCell actual={selectedSchool.no_of_parents} expected={selectedSchool.expected_parents} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Teachers</p>
                  <CapacityCell actual={selectedSchool.no_of_teachers} expected={selectedSchool.expected_teachers} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Admins</p>
                  <CapacityCell actual={selectedSchool.no_of_admins} expected={selectedSchool.expected_admins} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Staff</p>
                  <CapacityCell actual={selectedSchool.no_of_staff} expected={selectedSchool.expected_staff} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void confirmAndRun({
                      title: "Save school changes?",
                      message: `Save the new details for ${selectedSchool.name}?`,
                      confirmLabel: "Save changes",
                      tone: "primary",
                    }, () => performSaveDetails())
                  }
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#d88915] disabled:opacity-50"
                >
                  Save Changes
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void confirmAndRun({
                      title: "Increase school capacity?",
                      message: `Increase ${selectedSchool.name} by 50 users and distribute the extra capacity across the school categories?`,
                      confirmLabel: "Increase capacity",
                      tone: "primary",
                    }, () => performIncreaseUsers(selectedSchool.id))
                  }
                  disabled={busyId === selectedSchool.id}
                  className="inline-flex items-center gap-2 rounded-[16px] border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  Increase Users by 50
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void confirmAndRun({
                      title: "Regenerate school code?",
                      message: `Queue a new school code for ${selectedSchool.name}? Each school only gets 3 regeneration attempts.`,
                      confirmLabel: "Regenerate code",
                      tone: "warning",
                    }, () => performRegenerateCode(selectedSchool.id))
                  }
                  disabled={busyId === selectedSchool.id}
                  className="inline-flex items-center gap-2 rounded-[16px] border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Regenerate School Code
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleDownloadSecurityCodes(
                      selectedSchool.id,
                      selectedSchool.name,
                    )
                  }
                  disabled={busyId === selectedSchool.id}
                  className="inline-flex items-center gap-2 rounded-[16px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Download Security Codes
                </button>
              </div>

              <div className="rounded-[20px] border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <div><span className="font-semibold text-gray-900">Code changes used:</span> {selectedSchool.code_change_count}/3</div>
                <div><span className="font-semibold text-gray-900">Pending code change:</span> {formatDate(selectedSchool.pending_code_change_at)}</div>
                <div><span className="font-semibold text-gray-900">Pending status change:</span> {formatDate(selectedSchool.pending_status_change_at)}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
            onClick={closeCreatePanel}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[760px] overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Add School</h2>
                  <p className="text-sm text-gray-500">
                    Create a school profile, upload its logo, and send the email confirmation link.
                  </p>
                </div>
                <button
                  onClick={closeCreatePanel}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="rounded-[24px] border border-[#F3E6C8] bg-[#FFF9EE] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#A15B00]">Pending until email confirmation</p>
                    <p className="mt-1 text-sm text-[#7A5A2A]">
                      New schools stay in pending status until the school email confirms the verification link.
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                    Pending
                  </span>
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col items-center">
                  <div className="relative h-[132px] w-[132px] overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-[#F7F9E2]">
                    {createForm.logo ? (
                      <Image
                        src={createForm.logo}
                        alt="School logo preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#007146]">
                        {getInitials(createForm.name || "School")}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => createLogoInputRef.current?.click()}
                      disabled={uploadingLogoTarget === "create"}
                      className="rounded-[16px] border border-[#dbe8cc] bg-[#F7F9E2] px-5 py-3 text-sm font-semibold text-[#007146] disabled:opacity-60"
                    >
                      {uploadingLogoTarget === "create" ? "Uploading..." : "Upload School Logo"}
                    </button>
                    <input
                      ref={createLogoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadLogo(file, "create");
                        }
                      }}
                    />
                  </div>

                  <input
                    value={createForm.logo}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, logo: e.target.value }))}
                    placeholder="Uploaded logo URL will appear here"
                    className="mt-4 w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">School Name</label>
                    <input
                      value={createForm.name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">School Email</label>
                    <input
                      value={createForm.email}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Primary Phone</label>
                    <input
                      value={createForm.phone_1}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_1: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Phone 2</label>
                    <input
                      value={createForm.phone_2}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_2: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Phone 3</label>
                    <input
                      value={createForm.phone_3}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone_3: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Head Name</label>
                    <input
                      value={createForm.head_name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, head_name: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Owner Name</label>
                    <input
                      value={createForm.owner_name}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, owner_name: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Location</label>
                    <input
                      value={createForm.location}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, location: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Package</label>
                    <select
                      value={createForm.subscription_package}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, subscription_package: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    >
                      <option value="Seedling">Seedling</option>
                      <option value="Branch">Branch</option>
                      <option value="Canopy">Canopy</option>
                      <option value="Forest">Forest</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Status</label>
                    <select
                      value={createForm.subscription_status}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, subscription_status: e.target.value as SubscriptionStatus }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    >
                      <option value="inactive">Inactive</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                      <option value="trial">Trial</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Start</label>
                    <input
                      type="date"
                      value={createForm.subscription_started_at}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, subscription_started_at: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">Subscription Expiry</label>
                    <input
                      type="date"
                      value={createForm.subscription_expires_at}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, subscription_expires_at: e.target.value }))}
                      className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Capacity Setup</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Define the expected capacity values for this school at creation.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
                  {[
                    ["Expected Users", "expected_users"],
                    ["Students", "expected_students"],
                    ["Parents", "expected_parents"],
                    ["Teachers", "expected_teachers"],
                    ["Admins", "expected_admins"],
                    ["Staff", "expected_staff"],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {label}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={createForm[key as keyof SchoolCreateForm]}
                        onChange={(e) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void confirmAndRun({
                      title: "Create this school?",
                      message: `Create ${createForm.name || "this school"} and send the confirmation email to ${createForm.email || "the school email"}? The school will stay pending until that email is confirmed.`,
                      confirmLabel: "Create school",
                      tone: "primary",
                    }, () => performCreateSchool())
                  }
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#d88915] disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create School"}
                </button>

                <button
                  type="button"
                  onClick={closeCreatePanel}
                  className="inline-flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
