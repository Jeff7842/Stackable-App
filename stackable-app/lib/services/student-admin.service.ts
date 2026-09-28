// =============================================================================
// Student admin service — the business rules behind /api/students/**.
// -----------------------------------------------------------------------------
// No HTTP and no database: every function takes a StudentAdminStore (the Prisma
// one in production), so the rules live once and can be checked with a fake
// (lib/validation/students.check.ts). Throws ApiError; routes turn it into JSON.
// =============================================================================

import { badRequest, notFound } from "@/lib/api/errors";
import { bumpCache, cached } from "@/lib/cache";
import type {
  StudentDeleteResult,
  StudentFormOptions,
  StudentListData,
  StudentProfile,
  StudentUpdateResult,
} from "@/lib/dto/students";
import type { StudentAdminStore, StudentFieldChanges } from "@/lib/services/student-admin.store";
import type { StudentUpdateParsed } from "@/lib/validation/students";

// Lists and profiles are cached briefly; every write below bumps the school's cache.
const LIST_TTL_SECONDS = 60;
const PROFILE_TTL_SECONDS = 30;
const OPTIONS_TTL_SECONDS = 300;

/** Every student of the school with counts and the class filter list. */
export function readStudentList(store: StudentAdminStore, schoolId: string): Promise<StudentListData> {
  return cached(schoolId, "admin-students", LIST_TTL_SECONDS, () => store.list(schoolId));
}

/** Classes, school and statuses for filters and the edit form. */
export function readStudentFormOptions(store: StudentAdminStore, schoolId: string): Promise<StudentFormOptions> {
  return cached(schoolId, "admin-students-options", OPTIONS_TTL_SECONDS, () => store.formOptions(schoolId));
}

/**
 * One student's profile.
 *
 * @throws 404 when the student is not in the caller's school (same answer as "does not exist")
 */
export async function readStudentProfile(
  store: StudentAdminStore,
  schoolId: string,
  studentId: string,
): Promise<StudentProfile> {
  // "not found" is returned as undefined so the cache does not remember it.
  const profile = await cached(
    schoolId,
    "admin-student",
    PROFILE_TTL_SECONDS,
    async () => (await store.getProfile(schoolId, studentId)) ?? undefined,
    studentId,
  );
  if (!profile) throw notFound("Student not found.");
  return profile;
}

/**
 * Change one student (status toggle, class move, contact details).
 *
 * Why it exists: the old page updated the database straight from the browser with the
 * anon key, so any school's student could be changed and any class id written.
 *
 * @throws 404 not in this school; 400 when the class is not one of this school's
 */
export async function updateStudent(
  store: StudentAdminStore,
  schoolId: string,
  studentId: string,
  input: StudentUpdateParsed,
): Promise<StudentUpdateResult> {
  if (typeof input.class_id === "string" && !(await store.classExists(schoolId, input.class_id))) {
    throw badRequest("Selected class does not belong to your school.");
  }

  const changes: StudentFieldChanges = {};
  for (const key of Object.keys(input) as Array<keyof StudentUpdateParsed>) {
    if (input[key] !== undefined) (changes as Record<string, unknown>)[key] = input[key];
  }

  const found = await store.update(schoolId, studentId, changes);
  if (!found) throw notFound("Student not found.");
  await bumpCache(schoolId);

  const student = await store.getListItem(schoolId, studentId);
  if (!student) throw notFound("Student not found.");
  return { student };
}

/**
 * Delete a student record. The login account (users row) is kept, exactly as the
 * old page did; only the students row goes (assignments cascade in the database).
 *
 * @throws 404 not in this school
 */
export async function deleteStudent(
  store: StudentAdminStore,
  schoolId: string,
  studentId: string,
): Promise<StudentDeleteResult> {
  const removed = await store.remove(schoolId, studentId);
  if (!removed) throw notFound("Student not found.");
  await bumpCache(schoolId);
  return { id: studentId };
}
