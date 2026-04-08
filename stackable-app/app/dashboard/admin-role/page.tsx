"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";

type UserRole = "manager" | "admin" | "super-admin" | "teacher" | "student";
type UserStatus = "active" | "suspended" | "pending";

type SchoolOption = {
  id: string;
  name: string;
  code?: string;
};

type PermissionItem = {
  page_key: string;
  can_access: boolean;
};

type UserRow = {
  id: string;
  created_at: string;
  updated_at: string;
  school_id: string;
  school_code: string;
  school_adm: number | null;
  email: string | null;
  phone: number | null;
  phone_2: number | null;
  role: UserRole;
  status: UserStatus;
  first_name: string;
  last_name: string;
  must_change_password: boolean;
  schools?: {
    id: string;
    name: string;
    code?: string;
  } | null;
  permissions?: PermissionItem[];
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getFullName(user: Pick<UserRow, "first_name" | "last_name">) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unnamed user";
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "US";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function roleBadge(role: UserRole) {
  switch (role) {
    case "super-admin":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "admin":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "manager":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "teacher":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "student":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function statusBadge(status: UserStatus) {
  switch (status) {
    case "active":
      return "bg-green-50 text-green-700 border-green-200";
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "suspended":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F9E2] text-[#007146]">
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
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">No users found</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}

function UsersSkeleton() {
  return (
    <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
      <p className="mt-4 text-sm text-gray-500">Loading users...</p>
    </div>
  );
}

function ActionIcon({
  title,
  className,
  onClick,
  children,
  disabled,
}: {
  title: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

function SlideOver({
  open,
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-[760px]",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[5px] transition-all duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full transform bg-transparent transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className={cn("ml-auto h-full w-full", widthClass)}>
          <div className="flex h-full flex-col border-l border-gray-200 bg-[#F8FAFC] shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-[24px] font-bold tracking-tight text-gray-900">{title}</h2>
                {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function SearchableSchoolSelect({
  schools,
  value,
  onChange,
}: {
  schools: SchoolOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = schools.find((school) => school.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((school) => school.name.toLowerCase().includes(q));
  }, [schools, query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-800 outline-none transition hover:border-gray-300"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected?.name ?? "Select school"}
        </span>
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
          className={cn("transition-transform", open && "rotate-180")}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.12)]">
          <div className="sticky top-0 z-10 space-y-3 border-b border-gray-100 bg-white p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools..."
              className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
            />
            <button
              type="button"
              onClick={() => window.open("/dashboard/schools/new", "_blank", "noopener,noreferrer")}
              className="flex w-full items-center justify-center rounded-[16px] border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:border-[#F19F24] hover:text-[#F19F24]"
            >
              + Add new school
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length ? (
              filtered.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => {
                    onChange(school.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-left text-sm transition",
                    value === school.id
                      ? "bg-[#FFF7E9] text-[#B56A00]"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span>{school.name}</span>
                  {school.code ? <span className="text-xs text-gray-400">{school.code}</span> : null}
                </button>
              ))
            ) : (
              <div className="px-4 py-5 text-sm text-gray-500">No schools match your search.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RolePermissionEditor({
  role,
  pageKeys,
  permissions,
  onChange,
}: {
  role: UserRole;
  pageKeys: string[];
  permissions: PermissionItem[];
  onChange: (next: PermissionItem[]) => void;
}) {
  if (!["admin", "super-admin"].includes(role)) return null;

  const permissionMap = new Map(permissions.map((item) => [item.page_key, item.can_access]));

  function togglePermission(page_key: string, can_access: boolean) {
    const next = [...permissions.filter((item) => item.page_key !== page_key), { page_key, can_access }];
    onChange(next);
  }

  return (
    <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">Page access</h3>
        <p className="mt-1 text-sm text-gray-500">
          This only applies to admin-level roles. Manager, teacher and student do not use this block.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {pageKeys.map((pageKey) => {
          const allowed = permissionMap.get(pageKey) ?? true;

          return (
            <div
              key={pageKey}
              className="rounded-[18px] border border-gray-200 bg-[#FCFCFC] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold capitalize text-gray-900">
                    {pageKey.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Define whether this role holder can access this page.
                  </p>
                </div>

                <div className="flex rounded-[14px] border border-gray-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => togglePermission(pageKey, true)}
                    className={cn(
                      "rounded-[10px] px-3 py-2 text-xs font-semibold transition",
                      allowed ? "bg-green-50 text-green-700" : "text-gray-500"
                    )}
                  >
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePermission(pageKey, false)}
                    className={cn(
                      "rounded-[10px] px-3 py-2 text-xs font-semibold transition",
                      !allowed ? "bg-red-50 text-red-700" : "text-gray-500"
                    )}
                  >
                    Block
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { confirm } = useConfirmation();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [pageKeys, setPageKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    phone_2: "",
    school_id: "",
    role: "manager" as UserRole,
    photo_url: "",
    permissions: [] as PermissionItem[],
  });

  function showErrorToast(title: string, description?: string) {
    showToast({ type: "error", title, description });
  }

  function showSuccessToast(title: string, description?: string) {
    showToast({ type: "success", title, description });
  }

  const [editForm, setEditForm] = useState({
    id: "",
    email: "",
    status: "pending" as UserStatus,
    role: "manager" as UserRole,
    must_change_password: true,
    permissions: [] as PermissionItem[],
  });

  async function fetchUsers() {
    setLoading(true);
    const params = new URLSearchParams({
      search,
      role: roleFilter,
      status: statusFilter,
      schoolId: schoolFilter,
    });

    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();

    if (!res.ok) {
      showErrorToast("Users load failed", json.error || "Failed to load users.");
      setLoading(false);
      return;
    }

    setUsers(json.users ?? []);
    setPageKeys(json.pageKeys ?? []);
    setLoading(false);
  }

  async function fetchSchools() {
    const res = await fetch("/api/admin/schools", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) {
      setSchools(json.schools ?? []);
    } else {
      showErrorToast("Schools load failed", json.error || "Failed to load schools.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSchools();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchUsers();
    }, 250);

    return () => clearTimeout(timeout);
  }, [search, roleFilter, statusFilter, schoolFilter]);

  const filteredUsers = useMemo(() => {
    const next = [...users];

    next.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return getFullName(a).localeCompare(getFullName(b));
        case "name-desc":
          return getFullName(b).localeCompare(getFullName(a));
        case "role-asc":
          return a.role.localeCompare(b.role);
        case "role-desc":
          return b.role.localeCompare(a.role);
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        default:
          return 0;
      }
    });

    return next;
  }, [users, sortBy]);

  const totalEntries = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const pageStart = totalEntries === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalEntries);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search, roleFilter, statusFilter, schoolFilter, sortBy, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  function openViewModal(user: UserRow) {
    setViewUser(user);
    setEditUser(null);
  }

  function openEditModal(user: UserRow) {
    setEditUser(user);
    setViewUser(null);
    setEditForm({
      id: user.id,
      email: user.email ?? "",
      status: user.status,
      role: user.role,
      must_change_password: user.must_change_password,
      permissions: user.permissions ?? [],
    });
  }

  function openCreateModal() {
    setCreateOpen(true);
    setViewUser(null);
    setEditUser(null);
    setCreateForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      phone_2: "",
      school_id: "",
      role: "manager",
      photo_url: "",
      permissions: [],
    });
  }

  async function handleSuspendToggle(user: UserRow) {
    setBusyId(user.id);

    const nextStatus = user.status === "suspended" ? "active" : "suspended";

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        status: nextStatus,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      showErrorToast("Status update failed", json.error || "Failed to update status.");
      setBusyId(null);
      return;
    }

    setUsers((prev) =>
      prev.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item))
    );
    setBusyId(null);
    showSuccessToast(
      nextStatus === "suspended" ? "User suspended" : "User activated",
      `${getFullName(user)} is now ${nextStatus}.`,
    );
  }

  async function handleDelete(userId: string) {
    const user = users.find((item) => item.id === userId) ?? viewUser ?? editUser;
    const ok = await confirm({
      title: "Delete user?",
      message: `Delete ${user ? getFullName(user) : "this user"}? This action is permanent.`,
      confirmLabel: "Delete user",
      cancelLabel: "Cancel",
      tone: "danger",
    });

    if (!ok) return;

    setBusyId(userId);

    const res = await fetch(`/api/admin/users?id=${userId}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (!res.ok) {
      showErrorToast("Delete failed", json.error || "Failed to delete user.");
      setBusyId(null);
      return;
    }

    setUsers((prev) => prev.filter((item) => item.id !== userId));
    setBusyId(null);
    if (viewUser?.id === userId) setViewUser(null);
    if (editUser?.id === userId) setEditUser(null);
    showSuccessToast(
      "User deleted",
      user ? `${getFullName(user)} was removed.` : "The user was removed.",
    );
  }

  async function handleCreateUser() {
    const required = ["first_name", "last_name", "school_id", "role"] as const;
    for (const key of required) {
      if (!createForm[key]) {
        showErrorToast("Missing fields", "Fill all required fields.");
        return;
      }
    }

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    const json = await res.json();

    if (!res.ok) {
      showErrorToast("Create user failed", json.error || "Failed to create user.");
      return;
    }

    setCreateOpen(false);
    await fetchUsers();
    showSuccessToast(
      "User created",
      `${createForm.first_name} ${createForm.last_name}`.trim() || "The user was created.",
    );
  }

  async function handleUpdateUser(clearHistory = false) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        clear_history: clearHistory,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      showErrorToast("Update failed", json.error || "Failed to update user.");
      return;
    }

    await fetchUsers();

    const nextUser = users.find((item) => item.id === editForm.id);
    if (nextUser) {
      setEditUser({
        ...nextUser,
        email: editForm.email,
        status: editForm.status,
        role: editForm.role,
        must_change_password: editForm.must_change_password,
        permissions: editForm.permissions,
      });
    }

    if (clearHistory) {
      showSuccessToast("History cleared", "User history was cleared.");
    } else {
      showSuccessToast("User updated", "The user changes were saved.");
    }
  }

  function renderPagination() {
    if (totalPages <= 1) {
      return (
        <button className="min-w-[42px] rounded-xl border border-[#F19F24] bg-[#F19F24] px-4 py-2 text-sm font-medium text-white">
          1
        </button>
      );
    }

    const items: Array<number | "..."> = [];
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
              className={cn(
                "min-w-[42px] rounded-xl border px-4 py-2 text-sm font-medium transition",
                page === item
                  ? "border-[#F19F24] bg-[#F19F24] text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#F19F24] hover:text-[#F19F24]"
              )}
            >
              {item}
            </button>
          )
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
              User Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Central user register for managers, admins, super-admins, teachers and students.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-[16px] bg-[#4F6EF7] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-[#3d5ae0]"
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
            Add User
          </button>
        </div>

        <div className="mb-5 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                  placeholder="Search name, email, school, phone or role"
                  className="w-full bg-transparent px-3 py-3 text-sm text-gray-700 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="all">All roles</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="super-admin">Super Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
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
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
              </select>
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
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              >
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="role-asc">Role A–Z</option>
                <option value="role-desc">Role Z–A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-white bg-[#FFFDF8] p-5 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
        {loading ? (
          <UsersSkeleton />
        ) : totalEntries === 0 ? (
          <EmptyState message="Your current filters returned no user records." />
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#F8F8F8] text-left">
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4">User</th>
                    <th className="px-5 py-4">School</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Phone</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Must Change Password</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedUsers.map((user) => {
                    const fullName = getFullName(user);

                    return (
                      <tr
                        key={user.id}
                        className="border-t border-gray-100 text-sm text-gray-700 hover:bg-[#fffdf6]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0F4FF] text-sm font-semibold text-[#4F6EF7] ring-2 ring-[#EEF2FF]">
                              {getInitials(fullName)}
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => openViewModal(user)}
                                className="font-semibold text-gray-900 transition hover:text-[#4F6EF7]"
                              >
                                {fullName}
                              </button>
                              <div className="text-xs text-gray-500">
                                {formatDate(user.created_at)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">{user.schools?.name ?? "—"}</td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                              roleBadge(user.role)
                            )}
                          >
                            {user.role}
                          </span>
                        </td>

                        <td className="px-5 py-4">{user.email ?? "—"}</td>
                        <td className="px-5 py-4">{user.phone ?? "—"}</td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                              statusBadge(user.status)
                            )}
                          >
                            {user.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                              user.must_change_password
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-green-200 bg-green-50 text-green-700"
                            )}
                          >
                            {user.must_change_password ? "Required" : "Cleared"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <ActionIcon
                              title={user.status === "suspended" ? "Activate user" : "Suspend user"}
                              onClick={() => handleSuspendToggle(user)}
                              disabled={busyId === user.id}
                              className={
                                user.status === "suspended"
                                  ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              }
                            >
                              {user.status === "suspended" ? (
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
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              ) : (
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
                              )}
                            </ActionIcon>

                            <ActionIcon
                              title="View details"
                              onClick={() => openViewModal(user)}
                              className="border-[#dbe8ff] bg-[#EEF4FF] text-[#4F6EF7] hover:bg-[#E4ECFF]"
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
                            </ActionIcon>

                            <ActionIcon
                              title="Delete user"
                              onClick={() => handleDelete(user.id)}
                              disabled={busyId === user.id}
                              className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
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
                            </ActionIcon>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

      <SlideOver
        open={!!viewUser}
        onClose={() => setViewUser(null)}
        title={viewUser ? getFullName(viewUser) : "User details"}
        subtitle="Profile details and administrative controls"
      >
        {viewUser ? (
          <div className="space-y-5">
            <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-[#EEF2FF] bg-[#F0F4FF]">
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[#4F6EF7]">
                      {getInitials(getFullName(viewUser))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{getFullName(viewUser)}</h3>
                    <p className="mt-1 text-sm text-gray-500">{viewUser.email ?? "No email set"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", roleBadge(viewUser.role))}>
                        {viewUser.role}
                      </span>
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", statusBadge(viewUser.status))}>
                        {viewUser.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(viewUser)}
                  className="inline-flex items-center justify-center rounded-[16px] bg-[#4F6EF7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d5ae0]"
                >
                  Edit user
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {[
                ["School", viewUser.schools?.name ?? "—"],
                ["School Code", viewUser.school_code || "—"],
                ["Phone", viewUser.phone ?? "—"],
                ["Alternative Phone", viewUser.phone_2 ?? "—"],
                ["Must Change Password", viewUser.must_change_password ? "Yes" : "No"],
                ["Created", formatDate(viewUser.created_at)],
                ["Updated", formatDate(viewUser.updated_at)],
                ["School ADM", viewUser.school_adm ?? "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{String(value)}</p>
                </div>
              ))}
            </div>

            {["admin", "super-admin"].includes(viewUser.role) ? (
              <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Current page permissions</h4>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {pageKeys.map((key) => {
                    const permission = viewUser.permissions?.find((item) => item.page_key === key);
                    const allowed = permission ? permission.can_access : true;

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-[16px] border border-gray-200 bg-[#FCFCFC] px-4 py-3"
                      >
                        <span className="text-sm font-medium capitalize text-gray-800">
                          {key.replaceAll("_", " ")}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            allowed
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {allowed ? "Allowed" : "Blocked"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SlideOver>

      <SlideOver
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title={editUser ? `Edit ${getFullName(editUser)}` : "Edit user"}
        subtitle="Update core administrative settings"
      >
        {editUser ? (
          <div className="space-y-5">
            <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Email
                  </label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email"
                    className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        status: e.target.value as UserStatus,
                      }))
                    }
                    className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                  >
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="super-admin">Super Admin</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Must Change Password
                  </label>
                  <div className="flex rounded-[16px] border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          must_change_password: true,
                        }))
                      }
                      className={cn(
                        "flex-1 rounded-[12px] px-4 py-3 text-sm font-semibold transition",
                        editForm.must_change_password
                          ? "bg-amber-50 text-amber-700"
                          : "text-gray-500"
                      )}
                    >
                      Required
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          must_change_password: false,
                        }))
                      }
                      className={cn(
                        "flex-1 rounded-[12px] px-4 py-3 text-sm font-semibold transition",
                        !editForm.must_change_password
                          ? "bg-green-50 text-green-700"
                          : "text-gray-500"
                      )}
                    >
                      Cleared
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <RolePermissionEditor
              role={editForm.role}
              pageKeys={pageKeys}
              permissions={editForm.permissions}
              onChange={(next) => setEditForm((prev) => ({ ...prev, permissions: next }))}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleUpdateUser(false)}
                className="inline-flex items-center justify-center rounded-[16px] bg-[#4F6EF7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d5ae0]"
              >
                Save changes
              </button>

              <button
                type="button"
                onClick={() => void handleUpdateUser(true)}
                className="inline-flex items-center justify-center rounded-[16px] border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700"
              >
                Clear all history
              </button>

              <button
                type="button"
                onClick={() => void handleDelete(editForm.id)}
                className="inline-flex items-center justify-center rounded-[16px] border border-red-300 bg-red-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Delete user
              </button>
            </div>
          </div>
        ) : null}
      </SlideOver>

      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add user"
        subtitle="Create a new user and assign the school and role"
      >
        <div className="space-y-5">
          <div className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col items-center">
              <div className="group relative h-[120px] w-[120px] overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-[#F7F8FC]">
                {createForm.photo_url ? (
                  <Image
                    src={createForm.photo_url}
                    alt="Profile preview"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="34"
                      height="34"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="10" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 opacity-0 transition group-hover:bg-slate-900/45 group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {createForm.photo_url ? (
                      <>
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                      </>
                    ) : (
                      <>
                        <path d="M12 5v14m-7-7h14" />
                      </>
                    )}
                  </svg>
                </div>
              </div>

              <input
                value={createForm.photo_url}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    photo_url: e.target.value,
                  }))
                }
                placeholder="Paste uploaded bucket image URL"
                className="mt-4 w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
              />
              <p className="mt-2 text-xs text-gray-500">
                Use your bucket upload flow here. Do not upload with service role in the browser.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  First name
                </label>
                <input
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, first_name: e.target.value }))
                  }
                  placeholder="First name"
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Last name
                </label>
                <input
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, last_name: e.target.value }))
                  }
                  placeholder="Last name"
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email
                </label>
                <input
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="Email address"
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Phone
                </label>
                <input
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="Phone number"
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Alternative phone
                </label>
                <input
                  value={createForm.phone_2}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, phone_2: e.target.value }))
                  }
                  placeholder="Alternative phone"
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  School
                </label>
                <SearchableSchoolSelect
                  schools={schools}
                  value={createForm.school_id}
                  onChange={(value) => setCreateForm((prev) => ({ ...prev, school_id: value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                      permissions: [],
                    }))
                  }
                  className="w-full rounded-[18px] border border-gray-200 bg-[#FCFCFC] px-4 py-3 text-sm text-gray-700 outline-none"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="super-admin">Super Admin</option>
                </select>
              </div>
            </div>
          </div>

          <RolePermissionEditor
            role={createForm.role}
            pageKeys={pageKeys}
            permissions={createForm.permissions}
            onChange={(next) => setCreateForm((prev) => ({ ...prev, permissions: next }))}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCreateUser()}
              className="inline-flex items-center justify-center rounded-[16px] bg-[#4F6EF7] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3d5ae0]"
            >
              Create user
            </button>

            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="inline-flex items-center justify-center rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
