"use client";

// "Profile" tab: the one editable contact field the API accepts (email) plus the
// read-only account facts the old view panel showed.

import type { ReactNode } from "react";
import { Field, Input } from "@/components/ui";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { PasswordBadge } from "./Badges";
import { Section } from "./Section";
import { formatDate } from "./userUtils";

export interface ProfileTabProps {
  user: AdminUser;
  email: string;
  onEmailChange: (value: string) => void;
  emailError?: string;
  disabled: boolean;
}

export function ProfileTab({ user, email, onEmailChange, emailError, disabled }: ProfileTabProps) {
  const facts: Array<[string, ReactNode]> = [
    ["School", user.schools?.name ?? "—"],
    ["School code", user.school_code || "—"],
    ["Phone", user.phone ?? "—"],
    ["Alternative phone", user.phone_2 ?? "—"],
    ["School ADM", user.school_adm ?? "—"],
    ["Must change password", <PasswordBadge key="pw" required={user.must_change_password} size="sm" />],
    ["Created", formatDate(user.created_at)],
    ["Updated", formatDate(user.updated_at)],
  ];

  return (
    <div className="space-y-5">
      <Section title="Contact" description="The email address this person signs in and receives messages with.">
        <Field label="Email" error={emailError}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="Enter email"
            // Drawer focuses this on open (unless the form is read-only).
            {...(disabled ? {} : { "data-autofocus": true })}
            value={email}
            disabled={disabled}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Account details">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-recessed px-4 py-3">
              <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

export default ProfileTab;
