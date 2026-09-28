"use client";

// "Add user" drawer. Validation rules carried over from the old page: first
// name, last name, school and role are required. Extra light guards (email /
// phone / photo URL format when filled in) stop obviously bad input reaching the
// server. The parent re-mounts this component (via `key`) for every open, so the
// form always starts empty.

import { useId, useState, type FormEvent } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { Avatar, Button, Drawer, Field, Input, Select } from "@/components/ui";
import type {
  AdminSchoolOption,
  AdminUserPermission,
  AssignableRole,
  CreateAdminUserInput,
} from "@/hooks/useAdminUsers";
import { PermissionMatrix } from "./PermissionMatrix";
import { SchoolPicker } from "./SchoolPicker";
import { Section } from "./Section";
import { useUserActions } from "./useUserActions";
import {
  CREATE_ROLES,
  ROLE_LABEL,
  isAdminLevel,
  isHttpUrl,
  isValidEmail,
  isValidPhone,
  normalizePhone,
} from "./userUtils";

type Draft = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  phone_2: string;
  school_id: string;
  role: AssignableRole;
  photo_url: string;
  permissions: AdminUserPermission[];
};
type Errors = Partial<Record<"first_name" | "last_name" | "email" | "phone" | "phone_2" | "school_id" | "photo_url", string>>;

const EMPTY_DRAFT: Draft = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  phone_2: "",
  school_id: "",
  role: "manager",
  photo_url: "",
  permissions: [],
};

export interface CreateUserDrawerProps {
  open: boolean;
  onClose: () => void;
  schools: AdminSchoolOption[];
  schoolsLoading: boolean;
  pageKeys: string[];
  /** Only a super-admin may create another super-admin. */
  canGrantSuperAdmin: boolean;
}

export function CreateUserDrawer({ open, onClose, schools, schoolsLoading, pageKeys, canGrantSuperAdmin }: CreateUserDrawerProps) {
  const formId = useId();
  const { confirm } = useConfirmation();
  const { createUser, isCreating } = useUserActions();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Errors>({});

  const roles = CREATE_ROLES.filter((role) => role !== "super-admin" || canGrantSuperAdmin);
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key as keyof Errors] ? { ...e, [key]: undefined } : e));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!draft.first_name.trim()) next.first_name = "First name is required.";
    if (!draft.last_name.trim()) next.last_name = "Last name is required.";
    if (!draft.school_id) next.school_id = "Choose a school.";
    if (draft.email.trim() && !isValidEmail(draft.email)) next.email = "Enter a valid email address.";
    if (draft.phone.trim() && !isValidPhone(draft.phone)) next.phone = "Use 6 to 15 digits, with an optional leading +.";
    if (draft.phone_2.trim() && !isValidPhone(draft.phone_2)) next.phone_2 = "Use 6 to 15 digits, with an optional leading +.";
    if (draft.photo_url.trim() && !isHttpUrl(draft.photo_url)) next.photo_url = "Paste a full https:// image link.";
    return next;
  }

  async function requestClose() {
    if (isCreating) return;
    if (dirty) {
      const ok = await confirm({
        title: "Discard new user?",
        message: "The details you entered will be lost.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (isCreating) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: CreateAdminUserInput = {
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      school_id: draft.school_id,
      role: draft.role,
      ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
      ...(draft.phone.trim() ? { phone: normalizePhone(draft.phone) } : {}),
      ...(draft.phone_2.trim() ? { phone_2: normalizePhone(draft.phone_2) } : {}),
      ...(draft.photo_url.trim() ? { photo_url: draft.photo_url.trim() } : {}),
      permissions: isAdminLevel(draft.role) ? draft.permissions : [],
    };
    if (await createUser(payload)) onClose();
  }

  const fullName = `${draft.first_name} ${draft.last_name}`.trim();

  return (
    <Drawer
      open={open}
      onClose={() => void requestClose()}
      size="lg"
      title="Add user"
      subtitle="Create a new user and assign the school and role."
      footer={
        <>
          <Button variant="ghost" onClick={() => void requestClose()} disabled={isCreating}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={isCreating} leftIcon="solar:user-plus-linear">
            Create user
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
        <Section>
          <div className="mb-5 flex flex-col items-center gap-3">
            <Avatar name={fullName} src={isHttpUrl(draft.photo_url) ? draft.photo_url : undefined} size="xl" />
            <Field label="Photo URL" hint="Optional. Paste the public link of an uploaded image." error={errors.photo_url} className="w-full">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={draft.photo_url}
                onChange={(e) => set("photo_url", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" required error={errors.first_name}>
              <Input
                data-autofocus
                autoComplete="off"
                placeholder="First name"
                value={draft.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name" required error={errors.last_name}>
              <Input
                autoComplete="off"
                placeholder="Last name"
                value={draft.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
            <Field label="Email" error={errors.email} className="sm:col-span-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="Email address"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="Phone number"
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Alternative phone" error={errors.phone_2}>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="Alternative phone"
                value={draft.phone_2}
                onChange={(e) => set("phone_2", e.target.value)}
              />
            </Field>
            <Field label="School" required error={errors.school_id} className="sm:col-span-2">
              {(control) => (
                <SchoolPicker
                  id={control.id}
                  describedBy={control.describedBy}
                  invalid={control.invalid}
                  schools={schools}
                  loading={schoolsLoading}
                  value={draft.school_id}
                  onChange={(id) => set("school_id", id)}
                />
              )}
            </Field>
            <Field
              label="Role"
              required
              hint="New accounts start as pending and must change their password."
              className="sm:col-span-2"
            >
              <Select
                value={draft.role}
                onChange={(e) => {
                  // A different role starts with a clean permission set (as before).
                  setDraft((d) => ({ ...d, role: e.target.value as AssignableRole, permissions: [] }));
                }}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Page access" description="Which pages this person can open. Anything you leave switched on stays allowed.">
          <PermissionMatrix
            role={draft.role}
            pageKeys={pageKeys}
            value={draft.permissions}
            onChange={(next) => set("permissions", next)}
            disabled={isCreating}
          />
        </Section>
      </form>
    </Drawer>
  );
}

export default CreateUserDrawer;
