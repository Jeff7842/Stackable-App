"use client";

/**
 * SchoolFormFields - the sections of the create / edit form (profile,
 * subscription, capacity). Pure presentation: values, errors and change
 * handlers come from SchoolForm.
 */
import type { ReactNode } from "react";
import { Badge, Field, Input, Select } from "@/components/ui";
import type { SubscriptionStatus, SchoolStatus } from "@/hooks/useSchools";
import { LogoUploader } from "./LogoUploader";
import type { FormErrors, FormMode, SchoolFormValues } from "./formState";
import { PACKAGES, SCHOOL_STATUS_OPTIONS, SUBSCRIPTION_STATUS_OPTIONS } from "./utils";

export interface SchoolFormFieldsProps {
  mode: FormMode;
  /** Unique prefix for input ids (so errors can focus the right input). */
  uid: string;
  values: SchoolFormValues;
  errors: FormErrors;
  disabled: boolean;
  logoUploading: boolean;
  onChange: <K extends keyof SchoolFormValues>(key: K, value: SchoolFormValues[K]) => void;
  onLogoFile: (file: File) => void;
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-ghost">
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

const CAPACITY_INPUTS = [
  { key: "expected_users", label: "Expected users" },
  { key: "expected_students", label: "Students" },
  { key: "expected_parents", label: "Parents" },
  { key: "expected_teachers", label: "Teachers" },
  { key: "expected_admins", label: "Admins" },
  { key: "expected_staff", label: "Staff" },
] as const;

export function SchoolFormFields({
  mode,
  uid,
  values,
  errors,
  disabled,
  logoUploading,
  onChange,
  onLogoFile,
}: SchoolFormFieldsProps) {
  const id = (key: keyof SchoolFormValues) => `${uid}-${key}`;

  /** A text input wired to a form key. */
  const text = (
    key: keyof SchoolFormValues,
    label: string,
    extra: { required?: boolean; wide?: boolean; type?: string; autoFocus?: boolean; autoComplete?: string } = {},
  ) => (
    <Field
      label={label}
      required={extra.required}
      error={errors[key]}
      htmlFor={id(key)}
      className={extra.wide ? "sm:col-span-2" : undefined}
    >
      <Input
        type={extra.type ?? "text"}
        autoComplete={extra.autoComplete ?? "off"}
        value={values[key]}
        disabled={disabled}
        onChange={(event) => onChange(key, event.target.value as SchoolFormValues[typeof key])}
        {...(extra.autoFocus ? { "data-autofocus": "" } : {})}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      {mode === "create" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-tint p-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warning">Pending until email confirmation</p>
            <p className="mt-1 text-sm text-ink-soft">
              New schools stay in pending status until the school email confirms the verification link.
            </p>
          </div>
          <Badge tone="pending" dot>
            Pending
          </Badge>
        </div>
      ) : null}

      <Section title="School profile" description="Name, logo and how to reach the school.">
        <div className="space-y-6">
          <LogoUploader
            value={values.logo}
            name={values.name}
            uploading={logoUploading}
            disabled={disabled}
            onFile={onLogoFile}
            onUrlChange={(url) => onChange("logo", url)}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {text("name", "School name", { required: true, wide: true, autoFocus: mode === "create" })}
            {text("email", "School email", { required: true, type: "email", autoComplete: "email" })}
            {text("phone_1", "Primary phone", { required: true, type: "tel", autoComplete: "tel" })}
            {text("phone_2", "Phone 2", { type: "tel" })}
            {text("phone_3", "Phone 3", { type: "tel" })}
            {text("head_name", "Head name")}
            {text("owner_name", "Owner name")}
            {text("location", "Location", { wide: true })}
          </div>
        </div>
      </Section>

      <Section title="Subscription" description="Package, billing state and the dates it runs between.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Subscription package" htmlFor={id("subscription_package")}>
            <Select
              value={values.subscription_package}
              disabled={disabled}
              onChange={(event) => onChange("subscription_package", event.target.value)}
            >
              {/* Keep an unknown legacy package selectable so editing never silently changes it. */}
              {PACKAGES.includes(values.subscription_package as (typeof PACKAGES)[number]) ? null : (
                <option value={values.subscription_package}>{values.subscription_package}</option>
              )}
              {PACKAGES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Subscription status" htmlFor={id("subscription_status")}>
            <Select
              value={values.subscription_status}
              disabled={disabled}
              onChange={(event) => onChange("subscription_status", event.target.value as SubscriptionStatus)}
            >
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          {mode === "edit" ? (
            <Field label="School status" htmlFor={id("status")} className="sm:col-span-2">
              <Select
                value={values.status}
                disabled={disabled}
                onChange={(event) => onChange("status", event.target.value as SchoolStatus)}
              >
                {SCHOOL_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {text("subscription_started_at", "Subscription start", { type: "date" })}
          {text("subscription_expires_at", "Subscription expiry", { type: "date" })}
        </div>
      </Section>

      {mode === "create" ? (
        <Section title="Capacity setup" description="Define the expected capacity values for this school at creation.">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {CAPACITY_INPUTS.map(({ key, label }) => (
              <Field key={key} label={label} error={errors[key]} htmlFor={id(key)}>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values[key]}
                  disabled={disabled}
                  onChange={(event) => onChange(key, event.target.value)}
                />
              </Field>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
