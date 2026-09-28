"use client";

/**
 * Add teacher (/dashboard/teachers/new) - create a teacher profile, assign
 * one class and one subject, and upload the photo through the backend to the
 * private teachers_profile bucket.
 *
 * This page already posted to the API with `fetch` (never imported Supabase
 * directly, so it was not one of the six pages this pass had to migrate) but
 * was still on the old hex/lucide-react design - it is redesigned here onto
 * the shared design system and useTeacherFormOptions() / useCreateTeacher()
 * (hooks/useTeachers.ts) to match the rest of the workspace.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";
import { Button, EmptyState, Field, Input, Select, Skeleton } from "@/components/ui";
import { useCreateTeacher, useTeacherFormOptions } from "@/hooks/useTeachers";
import { classLabel } from "@/components/admin/teachers/utils";

type FormState = {
  name: string;
  admission_number: string;
  email: string;
  phone: string;
  school_id: string;
  class_id: string;
  subject_id: string;
};

const EMPTY: FormState = { name: "", admission_number: "", email: "", phone: "", school_id: "", class_id: "", subject_id: "" };

export default function NewTeacherPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const options = useTeacherFormOptions();
  const create = useCreateTeacher();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const schools = options.data?.schools ?? [];
  const classes = options.data?.classes ?? [];
  const subjects = options.data?.subjects ?? [];
  const filteredClasses = classes.filter((c) => !form.school_id || c.school_id === form.school_id);

  function patch(change: Partial<FormState>) {
    setForm((f) => {
      const next = { ...f, ...change };
      // Reset the class when it stops belonging to the chosen school.
      if (change.school_id !== undefined && next.class_id && !classes.some((c) => c.id === next.class_id && c.school_id === next.school_id)) {
        next.class_id = "";
      }
      return next;
    });
  }

  function handlePhotoFile(file: File) {
    setPhoto(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!photo || !form.name || !form.admission_number || !form.email || !form.phone || !form.class_id || !form.subject_id) {
      showToast({ type: "error", title: "Missing details", description: "Fill in every field and choose a photo before creating the teacher." });
      return;
    }

    try {
      const result = await create.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone,
        admission_number: form.admission_number,
        class_id: form.class_id,
        subject_id: Number(form.subject_id),
        photo,
      });
      showToast({ type: "success", title: "Teacher created", description: `${result.teacher.name} was added successfully.` });
      router.push(`/dashboard/teachers/${result.id}`);
    } catch (error) {
      showToast({
        type: "error",
        title: "Create teacher failed",
        description: error instanceof Error && error.message ? error.message : "Failed to create teacher.",
      });
    }
  }

  if (options.isLoading) {
    return (
      <div className="space-y-5 pb-6">
        <Skeleton className="h-96" rounded="2xl" />
      </div>
    );
  }

  if (options.isError) {
    return (
      <div className="rounded-2xl bg-surface shadow-soft ring-1 ring-ghost">
        <EmptyState
          icon="solar:danger-triangle-linear"
          title="Could not load the teacher form"
          description={options.error instanceof Error ? options.error.message : "Failed to load teacher form options."}
          action={
            <Button variant="secondary" leftIcon="solar:refresh-linear" onClick={() => void options.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <Button as="a" href="/dashboard/teachers" variant="ghost" size="sm" leftIcon="solar:arrow-left-linear">
          Back to teachers
        </Button>
        <p className="rounded-xl bg-primary-tint px-4 py-2.5 text-sm text-primary-ink">
          Photos are stored in the private <span className="font-semibold">teachers_profile</span> bucket, served by the backend only.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5 rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost">
          <h2 className="font-display text-lg font-semibold text-ink">Teacher details</h2>

          <div>
            <Field label="Teacher photo" required error={touched && !photo ? "A teacher photo is required." : undefined}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-[translate] duration-300 ease-standard hover:-translate-y-0.5">
                  Choose photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoFile(file);
                    }}
                  />
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-recessed text-ink-soft">
                    {photoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoPreview} alt="Teacher preview" className="size-full object-cover" />
                    ) : (
                      "No photo"
                    )}
                  </div>
                  <p className="text-sm text-ink-soft">{photo?.name || "JPG, PNG or WEBP, up to 5MB."}</p>
                </div>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Teacher name" required error={touched && !form.name ? "Required." : undefined}>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Enter full teacher name" />
            </Field>
            <Field label="Teacher ID" required error={touched && !form.admission_number ? "Required." : undefined}>
              <Input value={form.admission_number} onChange={(e) => patch({ admission_number: e.target.value })} placeholder="Enter teacher ID" />
            </Field>
            <Field label="Email address" required error={touched && !form.email ? "Required." : undefined}>
              <Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="teacher@school.com" />
            </Field>
            <Field label="Phone number" required error={touched && !form.phone ? "Required." : undefined}>
              <Input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="Enter phone number" />
            </Field>
            <Field label="School" required>
              <Select value={form.school_id} onChange={(e) => patch({ school_id: e.target.value })}>
                <option value="">Select school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Assigned class"
              required
              hint="Only classes without a class teacher can be assigned here."
              error={touched && !form.class_id ? "Required." : undefined}
            >
              <Select value={form.class_id} disabled={!form.school_id} onChange={(e) => patch({ class_id: e.target.value })}>
                <option value="">{form.school_id ? "Select class" : "Choose school first"}</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id} disabled={Boolean(c.class_teacher_id)}>
                    {classLabel(c)}
                    {c.class_teacher_id ? " - unavailable" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Teaching subject" required error={touched && !form.subject_id ? "Required." : undefined} className="sm:col-span-2">
              <Select value={form.subject_id} onChange={(e) => patch({ subject_id: e.target.value })}>
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.subject_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" loading={create.isPending} leftIcon="solar:diskette-linear">
              {create.isPending ? "Creating teacher" : "Create teacher"}
            </Button>
            <Button as="a" href="/dashboard/teachers" variant="ghost">
              Cancel
            </Button>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl bg-surface p-6 shadow-soft ring-1 ring-ghost">
            <h2 className="font-display text-lg font-semibold text-ink">Creation summary</h2>
            <p className="mt-1 text-sm text-ink-soft">This is the teacher profile that will be created on submit.</p>
            <dl className="mt-4 space-y-3">
              {[
                { label: "Teacher", value: form.name || "Waiting for teacher name" },
                { label: "Teacher ID", value: form.admission_number || "Waiting for teacher ID" },
                { label: "School", value: schools.find((s) => s.id === form.school_id)?.name || "Waiting for school selection" },
                {
                  label: "Assigned class",
                  value: (() => {
                    const selected = classes.find((c) => c.id === form.class_id);
                    return selected ? classLabel(selected) : "Waiting for class selection";
                  })(),
                },
                { label: "Subject", value: subjects.find((s) => String(s.id) === form.subject_id)?.subject_name || "Waiting for subject selection" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-recessed p-3">
                  <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl bg-primary-tint p-6">
            <h3 className="font-display text-base font-semibold text-primary-ink">Backend-first teacher creation</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              The form submits to the teacher API, uploads the image to the private bucket on the server, creates the teacher record,
              assigns the class and links the subject - all in one backend transaction.
            </p>
          </section>
        </aside>
      </form>
    </div>
  );
}
