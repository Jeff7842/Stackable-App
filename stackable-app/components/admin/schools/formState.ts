/**
 * Form state for the create / edit school drawer: value shape, defaults,
 * validation and the mapping to the API bodies.
 *
 * Everything is a string while the user types (inputs are strings), and is
 * converted once, in toCreateInput / toUpdateInput.
 */
import type {
  CreateSchoolInput,
  SchoolDetails,
  SchoolStatus,
  SubscriptionStatus,
  UpdateSchoolInput,
} from "@/hooks/useSchools";
import { toDateInput } from "./utils";

export type FormMode = "create" | "edit";

export type SchoolFormValues = {
  name: string;
  email: string;
  phone_1: string;
  phone_2: string;
  phone_3: string;
  head_name: string;
  owner_name: string;
  location: string;
  logo: string;
  /** The school's own status: only editable in edit mode (new schools start pending). */
  status: SchoolStatus;
  subscription_package: string;
  subscription_status: SubscriptionStatus;
  subscription_started_at: string; // YYYY-MM-DD
  subscription_expires_at: string; // YYYY-MM-DD or ""
  // Capacity (create only; existing schools change it with "Increase capacity").
  expected_users: string;
  expected_students: string;
  expected_parents: string;
  expected_teachers: string;
  expected_admins: string;
  expected_staff: string;
};

export type FormErrors = Partial<Record<keyof SchoolFormValues, string>>;

/** Same defaults the old "Add School" form used. */
export function createInitialValues(): SchoolFormValues {
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
    status: "pending",
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

/** Edit form starts from the record the API returned. */
export function valuesFromSchool(school: SchoolDetails): SchoolFormValues {
  return {
    ...createInitialValues(),
    name: school.name ?? "",
    email: school.email ?? "",
    phone_1: school.phone_1 ?? "",
    phone_2: school.phone_2 ?? "",
    phone_3: school.phone_3 ?? "",
    head_name: school.head_name ?? "",
    owner_name: school.owner_name ?? "",
    location: school.location ?? "",
    logo: school.logo ?? "",
    status: school.status,
    subscription_package: school.subscription_package,
    subscription_status: school.subscription_status,
    subscription_started_at: toDateInput(school.subscription_started_at),
    subscription_expires_at: toDateInput(school.subscription_expires_at),
    expected_users: String(school.expected_users ?? 0),
    expected_students: String(school.expected_students ?? 0),
    expected_parents: String(school.expected_parents ?? 0),
    expected_teachers: String(school.expected_teachers ?? 0),
    expected_admins: String(school.expected_admins ?? 0),
    expected_staff: String(school.expected_staff ?? 0),
  };
}

const CAPACITY_KEYS = [
  "expected_users",
  "expected_students",
  "expected_parents",
  "expected_teachers",
  "expected_admins",
  "expected_staff",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Field errors, keyed by field (empty object = valid).
 * Required: name, email, primary phone (the old page's rule, now shown per field).
 * Added: email format, expiry not before the start date, capacity = whole number >= 0.
 */
export function validate(values: SchoolFormValues, mode: FormMode): FormErrors {
  const errors: FormErrors = {};

  if (!values.name.trim()) errors.name = "School name is required.";

  if (!values.email.trim()) errors.email = "School email is required.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";

  if (!values.phone_1.trim()) errors.phone_1 = "Primary phone is required.";

  const { subscription_started_at: start, subscription_expires_at: end } = values;
  if (start && end && end < start) errors.subscription_expires_at = "Expiry must be on or after the start date.";

  if (mode === "create") {
    for (const key of CAPACITY_KEYS) {
      const raw = values[key].trim();
      if (raw !== "" && !/^\d+$/.test(raw)) errors[key] = "Whole number, 0 or more.";
    }
  }

  return errors;
}

/** Field order used to focus the first invalid input. */
export const FIELD_ORDER: (keyof SchoolFormValues)[] = [
  "name",
  "email",
  "phone_1",
  "subscription_expires_at",
  ...CAPACITY_KEYS,
];

const num = (value: string) => Number(value.trim() || 0);

/** POST /api/school body (the old page's shape: strings + expected_* as numbers). */
export function toCreateInput(values: SchoolFormValues): CreateSchoolInput {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone_1: values.phone_1.trim(),
    phone_2: values.phone_2.trim(),
    phone_3: values.phone_3.trim(),
    head_name: values.head_name.trim(),
    owner_name: values.owner_name.trim(),
    location: values.location.trim(),
    logo: values.logo.trim(),
    subscription_package: values.subscription_package,
    subscription_status: values.subscription_status,
    subscription_started_at: values.subscription_started_at,
    subscription_expires_at: values.subscription_expires_at,
    expected_users: num(values.expected_users),
    expected_students: num(values.expected_students),
    expected_parents: num(values.expected_parents),
    expected_teachers: num(values.expected_teachers),
    expected_admins: num(values.expected_admins),
    expected_staff: num(values.expected_staff),
  };
}

const orNull = (value: string) => value.trim() || null;

/**
 * PATCH /api/school/[id] body. All fields are always sent because the route
 * turns a missing phone_2 / phone_3 into null.
 */
export function toUpdateInput(values: SchoolFormValues): UpdateSchoolInput {
  return {
    name: values.name.trim(),
    head_name: orNull(values.head_name),
    owner_name: orNull(values.owner_name),
    email: orNull(values.email),
    phone_1: orNull(values.phone_1),
    phone_2: orNull(values.phone_2),
    phone_3: orNull(values.phone_3),
    location: orNull(values.location),
    logo: orNull(values.logo),
    status: values.status,
    subscription_package: values.subscription_package,
    subscription_status: values.subscription_status,
    subscription_started_at: orNull(values.subscription_started_at),
    subscription_expires_at: orNull(values.subscription_expires_at),
  };
}

export function isDirty(current: SchoolFormValues, initial: SchoolFormValues): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}

/** Logo checks run in the browser before the upload (the server has none). */
export const LOGO_MAX_BYTES = 4 * 1024 * 1024; // stays under the ~4.5 MB serverless request limit

export function checkLogoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Choose an image file (PNG, JPG, WebP or SVG).";
  if (file.size > LOGO_MAX_BYTES) return "The logo must be 4 MB or smaller.";
  return null;
}
