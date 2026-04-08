"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  IdCard,
  ImagePlus,
  Mail,
  Phone,
  Save,
  UserSquare2,
} from "lucide-react";
import { formatClassLabel } from "@/lib/teachers";

type SchoolOption = {
  id: string;
  name: string;
};

type ClassOption = {
  id: string;
  school_id: string;
  class_name: string;
  stream: string | null;
  class_teacher_id: string | null;
};

type SubjectOption = {
  id: number;
  subject_name: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldLabel({
  icon: Icon,
  label,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  helper?: string;
}) {
  return (
    <div className="mb-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F7F9E2] text-[#007146]">
          <Icon className="h-4 w-4" />
        </span>
        <span>{label}</span>
      </label>
      {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
    </div>
  );
}

function InputShell({
  children,
  invalid,
}: {
  children: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border bg-white px-4 py-3 shadow-sm transition",
        invalid ? "border-red-200" : "border-gray-200",
      )}
    >
      {children}
    </div>
  );
}

export default function NewTeacherPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  const [form, setForm] = useState({
    name: "",
    admission_number: "",
    email: "",
    phone: "",
    school_id: "",
    class_id: "",
    subject_id: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    async function fetchOptions() {
      try {
        setLoading(true);
        const res = await fetch("/api/teachers/form-options", {
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          error?: string;
          data?: {
            schools: SchoolOption[];
            classes: ClassOption[];
            subjects: SubjectOption[];
          };
        };

        if (!res.ok || !payload.data) {
          throw new Error(payload.error || "Failed to load teacher form options.");
        }

        setSchools(payload.data.schools);
        setClasses(payload.data.classes);
        setSubjects(payload.data.subjects);
      } catch (fetchError) {
        console.error(fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load teacher form options.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchOptions();
  }, []);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [photoFile]);

  const filteredClasses = classes.filter(
    (classItem) => !form.school_id || classItem.school_id === form.school_id,
  );

  useEffect(() => {
    if (!form.class_id) return;

    const stillAvailable = filteredClasses.some(
      (classItem) => classItem.id === form.class_id,
    );

    if (!stillAvailable) {
      setForm((current) => ({ ...current, class_id: "" }));
    }
  }, [filteredClasses, form.class_id]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (!photoFile) {
        throw new Error("Teacher photo is required.");
      }

      const payload = new FormData();
      payload.set("name", form.name);
      payload.set("admission_number", form.admission_number);
      payload.set("email", form.email);
      payload.set("phone", form.phone);
      payload.set("school_id", form.school_id);
      payload.set("class_id", form.class_id);
      payload.set("subject_id", form.subject_id);
      payload.set("photo", photoFile);

      const res = await fetch("/api/teachers", {
        method: "POST",
        body: payload,
      });

      const response = (await res.json()) as {
        error?: string;
        data?: { id: string };
      };

      if (!res.ok || !response.data) {
        throw new Error(response.error || "Failed to create teacher.");
      }

      router.push(`/dashboard/teachers/${response.data.id}`);
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create teacher.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/teachers"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#007146] transition hover:text-[#F19F24]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to teachers
          </Link>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight text-gray-900">
            Add Teacher
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new teacher profile, assign one class, choose the teaching
            subject, and upload the photo through the server to the private
            teachers bucket.
          </p>
        </div>

        <div className="rounded-[18px] border border-[#dbe8cc] bg-[#F7F9E2] px-4 py-3 text-sm text-[#007146] shadow-sm">
          Teacher photos are stored in <span className="font-semibold">teachers_profile</span>{" "}
          and served by the backend only.
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F19F24]" />
          <p className="mt-4 text-sm text-gray-500">Loading teacher form...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F9E2] text-[#007146]">
                <UserSquare2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Teacher Details</h2>
                <p className="text-sm text-gray-500">
                  Enter the teacher&apos;s basic information first, then link the
                  subject and class.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel
                  icon={ImagePlus}
                  label="Teacher Photo"
                  helper="This upload goes to the private teachers_profile bucket through the backend."
                />
                <InputShell invalid={!photoFile && submitting}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-[16px] bg-[#F19F24] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d88915]">
                      Choose Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          setPhotoFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </label>

                    <div className="flex items-center gap-3">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#F7F9E2] text-[#007146]">
                        {photoPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoPreview}
                            alt="Teacher preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlus className="h-7 w-7" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {photoFile?.name || "No photo selected yet"}
                        </p>
                        <p className="text-xs text-gray-500">
                          JPG, PNG, WEBP or any supported image up to 5MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </InputShell>
              </div>

              <div>
                <FieldLabel icon={UserSquare2} label="Teacher Name" />
                <InputShell invalid={!form.name && submitting}>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Enter full teacher name"
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  />
                </InputShell>
              </div>

              <div>
                <FieldLabel icon={IdCard} label="Teacher ID" helper="Saved in the teacher admission/ID field." />
                <InputShell invalid={!form.admission_number && submitting}>
                  <input
                    value={form.admission_number}
                    onChange={(event) =>
                      updateForm("admission_number", event.target.value)
                    }
                    placeholder="Enter teacher ID"
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  />
                </InputShell>
              </div>

              <div>
                <FieldLabel icon={Mail} label="Email Address" />
                <InputShell invalid={!form.email && submitting}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    placeholder="teacher@school.com"
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  />
                </InputShell>
              </div>

              <div>
                <FieldLabel icon={Phone} label="Phone Number" />
                <InputShell invalid={!form.phone && submitting}>
                  <input
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    placeholder="Enter phone number"
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  />
                </InputShell>
              </div>

              <div>
                <FieldLabel icon={Building2} label="School" />
                <InputShell invalid={!form.school_id && submitting}>
                  <select
                    value={form.school_id}
                    onChange={(event) => updateForm("school_id", event.target.value)}
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  >
                    <option value="">Select school</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>

              <div>
                <FieldLabel
                  icon={GraduationCap}
                  label="Assigned Class"
                  helper="Only free classes can be assigned to a new teacher here."
                />
                <InputShell invalid={!form.class_id && submitting}>
                  <select
                    value={form.class_id}
                    onChange={(event) => updateForm("class_id", event.target.value)}
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                    disabled={!form.school_id}
                  >
                    <option value="">
                      {form.school_id ? "Select class" : "Choose school first"}
                    </option>
                    {filteredClasses.map((classItem) => (
                      <option
                        key={classItem.id}
                        value={classItem.id}
                        disabled={Boolean(classItem.class_teacher_id)}
                      >
                        {formatClassLabel(classItem)}
                        {classItem.class_teacher_id ? " - unavailable" : ""}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>

              <div className="md:col-span-2">
                <FieldLabel icon={BookOpen} label="Teaching Subject" />
                <InputShell invalid={!form.subject_id && submitting}>
                  <select
                    value={form.subject_id}
                    onChange={(event) => updateForm("subject_id", event.target.value)}
                    className="w-full bg-transparent text-sm text-gray-700 outline-none"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={String(subject.id)}>
                        {subject.subject_name}
                      </option>
                    ))}
                  </select>
                </InputShell>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-[16px] bg-[#F19F24] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:translate-y-[-1px] hover:bg-[#d88915] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {submitting ? "Creating Teacher..." : "Create Teacher"}
              </button>

              <Link
                href="/dashboard/teachers"
                className="inline-flex items-center gap-2 rounded-[16px] border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-[#F19F24] hover:text-[#F19F24]"
              >
                Cancel
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E2] text-[#F19F24]">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Creation Summary</h2>
                  <p className="text-sm text-gray-500">
                    This is the teacher profile that will be created when you submit.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    icon: UserSquare2,
                    label: "Teacher",
                    value: form.name || "Waiting for teacher name",
                  },
                  {
                    icon: IdCard,
                    label: "Teacher ID",
                    value: form.admission_number || "Waiting for teacher ID",
                  },
                  {
                    icon: Building2,
                    label: "School",
                    value:
                      schools.find((school) => school.id === form.school_id)?.name ||
                      "Waiting for school selection",
                  },
                  {
                    icon: GraduationCap,
                    label: "Assigned Class",
                    value:
                      formatClassLabel(
                        classes.find((classItem) => classItem.id === form.class_id),
                      ) || "Waiting for class selection",
                  },
                  {
                    icon: BookOpen,
                    label: "Subject",
                    value:
                      subjects.find(
                        (subject) => String(subject.id) === form.subject_id,
                      )?.subject_name || "Waiting for subject selection",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-gray-100 bg-[#FCFCFC] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F9E2] text-[#007146]">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#dbe8cc] bg-[#F7F9E2] p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#007146]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[#0F5132]">
                    Backend-first teacher creation
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#2F5E46]">
                    The form submits to the teacher API, uploads the image to the
                    private bucket on the server, creates the teacher record, assigns
                    the class, and links the subject in one backend flow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
