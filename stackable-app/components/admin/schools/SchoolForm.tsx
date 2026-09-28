"use client";

/**
 * SchoolForm - the "Add school" / "Edit school" drawer.
 *
 * Create: defaults from the old form, POST /api/school, then the "school
 * created" dialog (offering the security-codes PDF to super-admins).
 * Edit: loads GET /api/school/[id] first (the list row lacks phone 2 / 3 and
 * location), PATCHes every field on save.
 *
 * Behaviour kept from the old page: confirm before create and before save,
 * closing is blocked while saving or uploading. Added: a "discard changes?"
 * prompt when closing a dirty form, inline field errors, client-side logo
 * checks and disabling Save until something changed.
 *
 * The parent mounts this with a fresh `key` for every open, so form state
 * always starts clean; it never unmounts it on close, so the exit animation
 * still shows the form.
 */
import { useId, useState, type FormEvent } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { Button, Drawer, EmptyState, Skeleton } from "@/components/ui";
import { useCreateSchool, useSchool, useUpdateSchool, useUploadSchoolLogo } from "@/hooks/useSchools";
import { SchoolFormFields } from "./SchoolFormFields";
import {
  FIELD_ORDER,
  checkLogoFile,
  createInitialValues,
  isDirty,
  toCreateInput,
  toUpdateInput,
  validate,
  valuesFromSchool,
  type FormErrors,
  type FormMode,
  type SchoolFormValues,
} from "./formState";
import type { SchoolPermissions } from "./permissions";
import type { SchoolActions } from "./useSchoolActions";
import { useErrorToast } from "./useErrorToast";

export interface SchoolFormProps {
  open: boolean;
  mode: FormMode;
  /** Required in edit mode. */
  schoolId?: string;
  onClose: () => void;
  permissions: SchoolPermissions;
  actions: SchoolActions;
}

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function SchoolForm({ open, mode, schoolId, onClose, permissions, actions }: SchoolFormProps) {
  const uid = useId();
  const formId = `${uid}-form`;
  const { confirm } = useConfirmation();
  const { showToast } = useToast();

  const detail = useSchool(mode === "edit" ? schoolId : null);
  const createMutation = useCreateSchool();
  const updateMutation = useUpdateSchool();
  const uploadMutation = useUploadSchoolLogo();

  const [seed] = useState(createInitialValues);
  const [initial, setInitial] = useState<SchoolFormValues>(seed);
  const [values, setValues] = useState<SchoolFormValues>(seed);
  const [errors, setErrors] = useState<FormErrors>({});
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Edit: fill the form once, when the REAL record arrives (never from list placeholder data,
  // which lacks phone 2 / 3 / location and would blank them on save).
  const record = mode === "edit" && detail.data && !detail.isPlaceholderData ? detail.data.data : null;
  if (record && seededFor !== schoolId) {
    const fromRecord = valuesFromSchool(record);
    setSeededFor(schoolId ?? null);
    setInitial(fromRecord);
    setValues(fromRecord);
  }

  const loadFailed = mode === "edit" && !record && detail.isError;
  const loadingRecord = mode === "edit" && !record && !detail.isError;
  useErrorToast(mode === "edit" ? detail.error : null, "Details load failed", "Failed to load school details.");

  const saving = createMutation.isPending || updateMutation.isPending;
  const busy = saving || uploadMutation.isPending;
  const dirty = isDirty(values, initial);

  const change = <K extends keyof SchoolFormValues>(key: K, value: SchoolFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the user edits it.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  async function requestClose() {
    if (busy) return;
    if (dirty) {
      const discard = await confirm({
        title: "Discard changes?",
        message: "You have unsaved changes. Close without saving?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        tone: "warning",
      });
      if (!discard) return;
    }
    onClose();
  }

  async function handleLogoFile(file: File) {
    const problem = checkLogoFile(file);
    if (problem) {
      showToast({ type: "error", title: "Logo upload failed", description: problem });
      return;
    }
    try {
      const url = await uploadMutation.mutateAsync(file);
      change("logo", url);
      showToast({ type: "success", title: "Logo uploaded", description: "School logo uploaded successfully." });
    } catch (error) {
      showToast({ type: "error", title: "Logo upload failed", description: errorText(error, "Failed to upload logo.") });
    }
  }

  async function createSchool() {
    const accepted = await confirm({
      title: "Create this school?",
      message: `Create ${values.name || "this school"} and send the confirmation email to ${values.email || "the school email"}? The school will stay pending until that email is confirmed.`,
      confirmLabel: "Create school",
      tone: "primary",
    });
    if (!accepted) return;

    try {
      const res = await createMutation.mutateAsync(toCreateInput(values));
      showToast({
        type: "success",
        title: "School created",
        description: "The school was created and the confirmation email was sent.",
      });
      onClose();

      // Only a super-admin may download the PDF, so only they are offered it.
      const created = res.data;
      const offerPdf = permissions.canSecurityCodes && Boolean(created?.id);
      const wantsPdf = await confirm({
        title: "School created successfully",
        message:
          `${created?.name ?? "The school"} was created with pending status. A confirmation email was sent to ${created?.email ?? "the school email"}.` +
          (offerPdf ? " Download the security codes PDF and keep it safely." : ""),
        confirmLabel: offerPdf ? "Download PDF" : "Done",
        cancelLabel: "Close",
        tone: "success",
        variant: "success",
        hideCancel: !offerPdf,
      });
      if (wantsPdf && offerPdf) await actions.downloadSecurityCodes({ id: created.id, name: created.name });
    } catch (error) {
      showToast({ type: "error", title: "Create school failed", description: errorText(error, "Failed to create school.") });
    }
  }

  async function saveSchool() {
    if (!schoolId) return;
    const accepted = await confirm({
      title: "Save school changes?",
      message: `Save the new details for ${values.name}?`,
      confirmLabel: "Save changes",
      tone: "primary",
    });
    if (!accepted) return;

    try {
      await updateMutation.mutateAsync({ id: schoolId, input: toUpdateInput(values) });
      showToast({ type: "success", title: "School updated", description: "The school changes were saved successfully." });
      onClose();
    } catch (error) {
      showToast({ type: "error", title: "Save failed", description: errorText(error, "Failed to save school details.") });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const found = validate(values, mode);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((key) => found[key]);
    if (firstInvalid) {
      document.getElementById(`${uid}-${firstInvalid}`)?.focus();
      return;
    }
    void (mode === "create" ? createSchool() : saveSchool());
  }

  return (
    <Drawer
      open={open}
      onClose={() => void requestClose()}
      size="lg"
      title={mode === "create" ? "Add school" : "Edit school"}
      subtitle={
        mode === "create"
          ? "Create a school profile, upload its logo, and send the email confirmation link."
          : "Edit school profile, subscription and status."
      }
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={() => void requestClose()}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={saving}
            disabled={loadingRecord || loadFailed || uploadMutation.isPending || (mode === "edit" && !dirty)}
          >
            {mode === "create" ? (saving ? "Creating" : "Create school") : saving ? "Saving" : "Save changes"}
          </Button>
        </>
      }
    >
      {loadFailed ? (
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Could not load this school"
          description={errorText(detail.error, "Failed to load school details.")}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void detail.refetch()}>
              Try again
            </Button>
          }
        />
      ) : loadingRecord ? (
        <div className="space-y-5" aria-busy="true" aria-label="Loading school">
          <Skeleton className="h-64" rounded="2xl" />
          <Skeleton className="h-48" rounded="2xl" />
        </div>
      ) : (
        <form id={formId} noValidate onSubmit={handleSubmit}>
          <SchoolFormFields
            mode={mode}
            uid={uid}
            values={values}
            errors={errors}
            disabled={saving}
            logoUploading={uploadMutation.isPending}
            onChange={change}
            onLogoFile={(file) => void handleLogoFile(file)}
          />
        </form>
      )}
    </Drawer>
  );
}
