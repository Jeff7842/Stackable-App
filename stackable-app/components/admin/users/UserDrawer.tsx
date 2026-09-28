"use client";

// One drawer for viewing AND editing a user: an identity card on top, then tabs
// (Profile / Role & status / Page permissions). Nothing is saved until "Save
// changes"; only the fields that actually changed are sent. The parent mounts
// this with a `key` per user, so it starts from that user's snapshot; after a
// save it keeps its own "last saved" copy so the dirty check stays honest even
// if the list under the current filters no longer contains the user.

import { useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { Avatar, Badge, Button, Drawer, Tabs } from "@/components/ui";
import {
  ASSIGNABLE_ROLES,
  type AdminUser,
  type AssignableRole,
  type UpdateAdminUserInput,
} from "@/hooks/useAdminUsers";
import type { Role } from "@/lib/validation/shared";
import { AccessTab } from "./AccessTab";
import { RoleBadge, StatusBadge } from "./Badges";
import { PermissionMatrix } from "./PermissionMatrix";
import { ProfileTab } from "./ProfileTab";
import { Section } from "./Section";
import { useUserActions } from "./useUserActions";
import {
  accessRules,
  formatDate,
  getFullName,
  isValidEmail,
  sameAccess,
  toDraft,
  type UserDraft,
  type Viewer,
} from "./userUtils";

export interface UserDrawerProps {
  /** The user as it was when the row was opened. */
  user: AdminUser;
  open: boolean;
  onClose: () => void;
  pageKeys: string[];
  viewer: Viewer;
  /** Super-admin only (the API enforces it too). */
  canDelete: boolean;
}

export function UserDrawer({ user, open, onClose, pageKeys, viewer, canDelete }: UserDrawerProps) {
  const { confirm } = useConfirmation();
  const actions = useUserActions();
  const [base, setBase] = useState<AdminUser>(user); // last saved state
  const [draft, setDraft] = useState<UserDraft>(() => toDraft(user));
  const [tab, setTab] = useState("profile");
  const [emailError, setEmailError] = useState<string>();

  const { isSelf, readOnly, lockAccess } = accessRules(base, viewer);
  const name = getFullName(base);

  const saved = toDraft(base);
  const email = draft.email.trim();
  const permsChanged = !sameAccess(draft.permissions, saved.permissions, pageKeys);
  const dirty =
    email !== saved.email ||
    draft.status !== saved.status ||
    draft.role !== saved.role ||
    draft.must_change_password !== saved.must_change_password ||
    permsChanged;

  // Roles the API accepts, minus super-admin unless you are one, plus the user's current role.
  const roleOptions = Array.from(
    new Set<Role>([
      ...ASSIGNABLE_ROLES.filter((r) => r !== "super-admin" || viewer.role === "super-admin"),
      base.role,
    ]),
  );

  function patch(change: Partial<UserDraft>) {
    setDraft((d) => ({ ...d, ...change }));
    if (change.email !== undefined) setEmailError(undefined);
  }

  async function requestClose() {
    if (actions.isSaving) return;
    if (dirty) {
      const ok = await confirm({
        title: "Discard changes?",
        message: `You have unsaved changes to ${name}.`,
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "warning",
      });
      if (!ok) return;
    }
    onClose();
  }

  async function save() {
    if (email && !isValidEmail(email)) {
      setEmailError("Enter a valid email address.");
      setTab("profile");
      return;
    }
    // Always send email/status/password flag (the route always updates the users
    // row); role and permissions only when they changed.
    const input: UpdateAdminUserInput = {
      id: base.id,
      email,
      status: draft.status,
      must_change_password: draft.must_change_password,
      ...(draft.role !== base.role ? { role: draft.role as AssignableRole } : {}),
      ...(permsChanged ? { permissions: draft.permissions } : {}),
    };
    if (await actions.saveChanges(input)) {
      setBase((b) => ({
        ...b,
        email: email || null,
        status: draft.status,
        role: draft.role,
        must_change_password: draft.must_change_password,
        permissions: permsChanged ? draft.permissions : b.permissions,
      }));
      setDraft((d) => ({ ...d, email }));
    }
  }

  async function remove() {
    if (await actions.deleteUser(base)) onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={() => void requestClose()}
      size="lg"
      title="User details"
      subtitle="Profile details and administrative controls."
      footer={
        <>
          <Button
            variant="ghost"
            leftIcon="solar:restart-linear"
            disabled={!dirty || actions.isSaving}
            onClick={() => {
              setDraft(toDraft(base));
              setEmailError(undefined);
            }}
          >
            Reset
          </Button>
          <Button
            leftIcon="solar:check-circle-linear"
            loading={actions.isSaving}
            disabled={!dirty || readOnly}
            onClick={() => void save()}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Identity card */}
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
          <Avatar name={name} size="xl" />
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-semibold text-ink">{name}</h3>
            <p className="truncate text-sm text-ink-soft">{base.email ?? "No email set"}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <RoleBadge role={base.role} />
              <StatusBadge status={base.status} />
              {isSelf ? <Badge tone="info">You</Badge> : null}
            </div>
            <p className="mt-2 text-xs text-muted">
              {base.schools?.name ? `${base.schools.name} · ` : ""}Joined {formatDate(base.created_at)}
            </p>
          </div>
        </div>

        <Tabs
          aria-label="User sections"
          value={tab}
          onValueChange={setTab}
          fullWidth
          items={[
            {
              id: "profile",
              label: "Profile",
              icon: "solar:user-id-linear",
              content: (
                <ProfileTab
                  user={base}
                  email={draft.email}
                  onEmailChange={(value) => patch({ email: value })}
                  emailError={emailError}
                  disabled={readOnly}
                />
              ),
            },
            {
              id: "access",
              label: "Role & status",
              icon: "solar:shield-user-linear",
              content: (
                <AccessTab
                  user={base}
                  draft={draft}
                  onDraftChange={patch}
                  roleOptions={roleOptions}
                  readOnly={readOnly}
                  lockAccess={lockAccess}
                  isSelf={isSelf}
                  canDelete={canDelete}
                  busy={actions.busyId === base.id}
                  onClearHistory={() => void actions.clearHistory(base)}
                  onDelete={() => void remove()}
                />
              ),
            },
            {
              id: "permissions",
              label: "Page permissions",
              icon: "solar:key-minimalistic-2-linear",
              content: (
                <Section
                  title="Page access"
                  description="Choose which pages this person can open. Pages you leave switched on stay allowed."
                >
                  <PermissionMatrix
                    role={draft.role}
                    pageKeys={pageKeys}
                    value={draft.permissions}
                    onChange={(next) => patch({ permissions: next })}
                    disabled={lockAccess}
                  />
                </Section>
              ),
            },
          ]}
        />
      </div>
    </Drawer>
  );
}

export default UserDrawer;
