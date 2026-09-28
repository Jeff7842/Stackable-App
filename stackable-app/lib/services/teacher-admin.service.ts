// =============================================================================
// Teacher admin service — the business rules behind PATCH/DELETE/timetable/edit-data.
// -----------------------------------------------------------------------------
// No HTTP and no database in here: every function takes a TeacherAdminStore (the
// Prisma one in production) and a photo storage, so the rules are
// written ONCE and can be checked with fakes (lib/validation/teachers.check.ts).
// Throws ApiError for expected failures; routes turn them into JSON with
// toErrorResponse().
// =============================================================================

import crypto from "crypto";
import { ApiError, badRequest, notFound } from "@/lib/api/errors";
import { bumpCache, cached } from "@/lib/cache";
import type {
  TeacherAttendanceData,
  TeacherCreateResult,
  TeacherDeleteResult,
  TeacherEditData,
  TeacherFormOptions,
  TeacherListItem,
  TeacherProfileData,
  TeacherTimetableData,
  TeacherTimetableSaveResult,
  TeacherUpdateResult,
  TimetableWriteRow,
} from "@/lib/dto/teachers";
import { formatClassLabel } from "@/lib/teachers";
import { findTimetableConflicts } from "@/lib/timetable";
import type {
  TeacherAdminStore,
  TeacherFieldChanges,
  TeacherRow,
  TeacherWritePlan,
} from "@/lib/services/teacher-admin.store";
import type { TeacherCreateParsed, TeacherUpdateParsed } from "@/lib/validation/teachers";

// Reads are cached briefly: the page is opened, edited and re-opened in seconds, and
// every write below calls bumpCache(schoolId) so an admin never sees their own edit late.
const READ_TTL_SECONDS = 30;

/** Where a replaced or removed photo file lives. The real one is lib/teacher-photo.ts; tests pass a fake. */
export interface PhotoStorage {
  /** Validate and store the file; returns its storage path and the app URL. */
  upload(teacherId: string, file: File): Promise<{ path: string; url: string }>;
  /** Best-effort delete of a stored file. Never throws. */
  remove(path: string | null): Promise<void>;
  /** The storage path behind a profile_photo URL when it is one of ours, else null. */
  pathFromUrl(url: string | null | undefined, teacherId: string): string | null;
}

const conflict = (message: string, code: string, details?: unknown) =>
  new ApiError(409, message, { code, details });

/** true for a database unique-constraint error from either backend (Prisma P2002, Postgres 23505 text). */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  return code === "P2002" || code === "23505" || /duplicate key value|unique constraint/i.test(message);
}

async function requireTeacher(store: TeacherAdminStore, schoolId: string, teacherId: string): Promise<TeacherRow> {
  const row = await store.getTeacherRow(schoolId, teacherId);
  if (!row) throw notFound("Teacher not found.");
  return row;
}

/** Every class id / subject id a timetable mentions must exist (class ids: in THIS school). */
async function assertTimetableReferences(
  store: TeacherAdminStore,
  schoolId: string,
  slots: TimetableWriteRow[],
  knownClassIds?: Set<string>,
): Promise<void> {
  const classIds = new Set(slots.map((slot) => slot.class_id).filter((id): id is string => id !== null));
  if (classIds.size > 0) {
    const schoolClassIds =
      knownClassIds ?? new Set((await store.listClasses(schoolId)).map((item) => item.id));
    for (const [index, slot] of slots.entries()) {
      if (slot.class_id && !schoolClassIds.has(slot.class_id)) {
        throw badRequest(`Timetable item ${index + 1} uses a class that does not belong to your school.`);
      }
    }
  }

  const subjectIds = Array.from(
    new Set(slots.map((slot) => slot.subject_id).filter((id): id is number => id !== null)),
  );
  if (subjectIds.length > 0) {
    const found = await store.findSubjects(subjectIds);
    if (found.length !== subjectIds.length) {
      throw badRequest("Timetable uses a subject that does not exist.");
    }
  }
}

// ---- reads -------------------------------------------------------------------

/** Every teacher of the school (GET /api/teachers rows). */
export function readTeacherList(store: TeacherAdminStore, schoolId: string): Promise<TeacherListItem[]> {
  return cached(schoolId, "admin-teachers", READ_TTL_SECONDS, () => store.listTeachers(schoolId));
}

/** Schools, classes and subject catalogue for the create form. */
export function readTeacherFormOptions(store: TeacherAdminStore, schoolId: string): Promise<TeacherFormOptions> {
  return cached(schoolId, "admin-teachers-options", READ_TTL_SECONDS, () => store.getFormOptions(schoolId));
}

/** A teacher and the pupils of their classes (GET /api/teachers/[id]). @throws 404 */
export async function readTeacherProfile(
  store: TeacherAdminStore,
  schoolId: string,
  teacherId: string,
): Promise<TeacherProfileData> {
  const data = await cached(
    schoolId,
    "admin-teacher-profile",
    READ_TTL_SECONDS,
    async () => (await store.getProfile(schoolId, teacherId)) ?? undefined,
    teacherId,
  );
  if (!data) throw notFound("Teacher not found.");
  return data;
}

/**
 * Everything the teacher edit page needs in one call.
 *
 * @throws 404 when the teacher is not in the caller's school
 */
export async function readEditData(
  store: TeacherAdminStore,
  schoolId: string,
  teacherId: string,
): Promise<TeacherEditData> {
  // "not found" is returned as undefined so the cache does not remember it.
  const data = await cached(
    schoolId,
    "admin-teacher-edit",
    READ_TTL_SECONDS,
    async () => (await store.getEditData(schoolId, teacherId)) ?? undefined,
    teacherId,
  );
  if (!data) throw notFound("Teacher not found.");
  return data;
}

/** The teacher's timetable with the class and subject lists that label it. @throws 404 */
export async function readTimetable(
  store: TeacherAdminStore,
  schoolId: string,
  teacherId: string,
): Promise<TeacherTimetableData> {
  const data = await cached(
    schoolId,
    "admin-teacher-timetable",
    READ_TTL_SECONDS,
    async () => (await store.getTimetable(schoolId, teacherId)) ?? undefined,
    teacherId,
  );
  if (!data) throw notFound("Teacher not found.");
  return data;
}

/** The teacher's clock-in history and summary. @throws 404 */
export async function readAttendance(
  store: TeacherAdminStore,
  schoolId: string,
  teacherId: string,
  limit: number,
): Promise<TeacherAttendanceData> {
  const data = await cached(
    schoolId,
    "admin-teacher-attendance",
    READ_TTL_SECONDS,
    async () => (await store.getAttendance(schoolId, teacherId, limit)) ?? undefined,
    `${teacherId}:${limit}`,
  );
  if (!data) throw notFound("Teacher not found.");
  return data;
}

// ---- update ------------------------------------------------------------------

/**
 * Save the teacher edit form: profile fields, status, class-teacher ownership,
 * subjects, timetable and photo, applied together or not at all.
 *
 * Why it exists: the old edit page did ten separate browser-to-database calls
 * with the anon key and no rollback, and nothing checked that the class, subjects
 * or teacher belonged to the admin's school.
 *
 * @param store data backend
 * @param photos photo storage (real or fake)
 * @param schoolId the caller's school, from the session
 * @param teacherId teacher to change
 * @param input validated changes; omitted keys are untouched
 * @param photo replacement photo, if uploaded
 * @throws 404 not in this school; 400 bad class/subject/photo; 409 email, teacher ID or class already taken
 */
export async function updateTeacher(
  store: TeacherAdminStore,
  photos: PhotoStorage,
  schoolId: string,
  teacherId: string,
  input: TeacherUpdateParsed,
  photo: File | null,
): Promise<TeacherUpdateResult> {
  const row = await requireTeacher(store, schoolId, teacherId);

  // 1. Email and teacher ID are globally unique columns: say so nicely before the database does.
  const emailChanged = input.email !== undefined && input.email !== row.email;
  const admissionChanged =
    input.admission_number !== undefined && input.admission_number !== row.admission_number;
  if (emailChanged || admissionChanged) {
    const taken = await store.findIdentityConflicts({
      email: emailChanged ? input.email : undefined,
      admissionNumber: admissionChanged ? input.admission_number : undefined,
      excludeTeacherId: teacherId,
    });
    if (taken.admission_number) {
      throw conflict("A teacher with that ID already exists.", "TEACHER_ID_TAKEN");
    }
    if (taken.email) {
      throw conflict("A teacher with that email already exists.", "TEACHER_EMAIL_TAKEN");
    }
  }

  // 2. Class-teacher ownership. Turning class teacher OFF releases every class; a class id
  //    only makes sense while the flag is on (the old page disabled the picker otherwise).
  const flagAfter = input.class_teacher ?? row.class_teacher ?? false;
  let classOwnership: string | null | undefined;
  if (input.class_teacher === false) {
    classOwnership = null;
  } else if (input.class_teacher_class_id !== undefined) {
    if (input.class_teacher_class_id !== null && !flagAfter) {
      throw badRequest("Mark the teacher as a class teacher before choosing the class they lead.");
    }
    classOwnership = input.class_teacher_class_id;
  }

  const needsClasses = typeof classOwnership === "string" || (input.timetable?.some((slot) => slot.class_id) ?? false);
  const classes = needsClasses ? await store.listClasses(schoolId) : [];
  const schoolClassIds = new Set(classes.map((item) => item.id));

  if (typeof classOwnership === "string") {
    const target = classes.find((item) => item.id === classOwnership);
    if (!target) throw badRequest("Selected class does not belong to your school.");
    if (target.class_teacher_id && target.class_teacher_id !== teacherId) {
      throw conflict("That class is already assigned to another teacher.", "CLASS_TEACHER_TAKEN");
    }
  }

  // 3. Subjects: the first one is the primary subject (teachers.subject_id), as on the old page.
  const fields: TeacherFieldChanges = {};
  if (input.name !== undefined) fields.name = input.name;
  if (input.email !== undefined) fields.email = input.email;
  if (input.phone !== undefined) fields.phone = input.phone;
  if (input.admission_number !== undefined) fields.admission_number = input.admission_number;
  if (input.status !== undefined) fields.status = input.status;
  if (input.class_teacher !== undefined) fields.class_teacher = input.class_teacher;

  if (input.subject_ids !== undefined) {
    if (input.subject_ids.length > 0) {
      const found = await store.findSubjects(input.subject_ids);
      if (found.length !== input.subject_ids.length) throw badRequest("One or more subjects do not exist.");
    }
    fields.subject_id = input.subject_ids[0] ?? null;
  }

  // 4. Timetable references (class ids of THIS school, real subjects). Overlaps are only warnings.
  let timetableConflicts: TeacherUpdateResult["timetable_conflicts"] = [];
  if (input.timetable !== undefined) {
    await assertTimetableReferences(store, schoolId, input.timetable, needsClasses ? schoolClassIds : undefined);
    timetableConflicts = findTimetableConflicts(input.timetable);
  }

  // 5. Photo last, so a rejected form never leaves an orphan file behind.
  let uploaded: { path: string; url: string } | null = null;
  if (photo) {
    uploaded = await photos.upload(teacherId, photo);
    fields.profile_photo = uploaded.url;
  } else if (input.remove_photo) {
    fields.profile_photo = null;
  }

  const plan: TeacherWritePlan = {
    schoolId,
    teacherId,
    fields,
    classOwnership,
    subjectIds: input.subject_ids,
    timetable: input.timetable,
  };

  try {
    await store.applyUpdate(plan);
  } catch (error) {
    // The database change was rolled back, so the new photo must not stay in storage.
    if (uploaded) await photos.remove(uploaded.path);
    // Lost a race with another admin for the same email / teacher ID: still a clean 409.
    if (isUniqueViolation(error)) {
      throw conflict("Another teacher already uses that email or teacher ID.", "TEACHER_IDENTITY_TAKEN");
    }
    throw error;
  }

  // The old photo is only removed after the row points at the new one (or at nothing).
  if (fields.profile_photo !== undefined) {
    const previous = photos.pathFromUrl(row.profile_photo, teacherId);
    if (previous && previous !== uploaded?.path) await photos.remove(previous);
  }

  await bumpCache(schoolId);

  const refreshed = await store.getTeacherListItem(schoolId, teacherId);
  if (!refreshed) throw notFound("Teacher not found.");
  return { id: teacherId, teacher: refreshed, timetable_conflicts: timetableConflicts };
}

// ---- timetable ---------------------------------------------------------------

/**
 * Replace a teacher's whole weekly timetable (atomic).
 *
 * @throws 404 not in this school; 400 unknown class/subject
 */
export async function saveTimetable(
  store: TeacherAdminStore,
  schoolId: string,
  teacherId: string,
  slots: TimetableWriteRow[],
): Promise<TeacherTimetableSaveResult> {
  await requireTeacher(store, schoolId, teacherId);
  await assertTimetableReferences(store, schoolId, slots);
  await store.replaceTimetable(schoolId, teacherId, slots);
  await bumpCache(schoolId);

  const saved = await store.getTimetable(schoolId, teacherId);
  if (!saved) throw notFound("Teacher not found.");
  return { slots: saved.slots, conflicts: findTimetableConflicts(slots) };
}

// ---- delete ------------------------------------------------------------------

/**
 * Delete a teacher.
 *
 * Why the grading-report guard: the database deletes a teacher's grading_reports
 * with them (ON DELETE CASCADE), and the old page did that silently. Now the first
 * call answers 409 with the count; the UI repeats the call with force=true after the
 * admin confirms they are happy to lose those grades.
 *
 * @throws 404 not in this school; 409 TEACHER_HAS_GRADING_REPORTS unless force
 */
export async function deleteTeacher(
  store: TeacherAdminStore,
  photos: PhotoStorage,
  schoolId: string,
  teacherId: string,
  force: boolean,
): Promise<TeacherDeleteResult> {
  const row = await requireTeacher(store, schoolId, teacherId);

  const reports = await store.countGradingReports(teacherId);
  if (reports > 0 && !force) {
    throw conflict(
      `This teacher recorded ${reports} grading result${reports === 1 ? "" : "s"} that would be deleted with them. Confirm to delete anyway.`,
      "TEACHER_HAS_GRADING_REPORTS",
      { grading_reports: reports },
    );
  }

  const deleted = await store.deleteTeacher(schoolId, teacherId);
  if (!deleted) throw notFound("Teacher not found.");

  await photos.remove(photos.pathFromUrl(row.profile_photo, teacherId));
  await bumpCache(schoolId);
  return { id: teacherId };
}

// ---- create ------------------------------------------------------------------

/**
 * Create a teacher: profile, photo, class-teacher ownership of one class and one subject.
 *
 * Why it exists: POST /api/teachers used to do this with several separate calls and a hand
 * rolled undo. Now the rows are written in one transaction and only the photo needs cleanup.
 *
 * @param photos photo storage (real or fake)
 * @param schoolId the caller's school, from the session (never from the body)
 * @param input validated form fields
 * @param photo the uploaded image
 * @throws 404 school/subject missing; 400 class not in this school or bad photo; 409 teacher ID,
 *         email or class already taken
 */
export async function createTeacher(
  store: TeacherAdminStore,
  photos: PhotoStorage,
  schoolId: string,
  input: TeacherCreateParsed,
  photo: File,
): Promise<TeacherCreateResult> {
  const context = await store.findCreateContext(schoolId, input.class_id, input.subject_id);
  if (!context.school) throw notFound("School not found.");
  if (!context.klass) throw badRequest("Selected class does not belong to the chosen school.");
  if (!context.subject) throw notFound("Subject not found.");

  const taken = await store.findIdentityConflicts({
    email: input.email,
    admissionNumber: input.admission_number,
  });
  if (taken.admission_number) throw conflict("A teacher with that ID already exists.", "TEACHER_ID_TAKEN");
  if (taken.email) throw conflict("A teacher with that email already exists.", "TEACHER_EMAIL_TAKEN");
  if (context.klass.class_teacher_id) {
    throw conflict("That class is already assigned to another teacher.", "CLASS_TEACHER_TAKEN");
  }

  // Generated here so the photo path can contain the teacher id; the photo goes up last
  // (after every check) and is removed again if the transaction fails.
  const teacherId = crypto.randomUUID();
  const uploaded = await photos.upload(teacherId, photo);

  try {
    await store.createTeacher({
      id: teacherId,
      schoolId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      admissionNumber: input.admission_number,
      profilePhoto: uploaded.url,
      subjectId: input.subject_id,
      classId: input.class_id,
    });
  } catch (error) {
    await photos.remove(uploaded.path);
    if (isUniqueViolation(error)) {
      throw conflict("Another teacher already uses that email or teacher ID.", "TEACHER_IDENTITY_TAKEN");
    }
    throw error;
  }

  await bumpCache(schoolId);

  return {
    id: teacherId,
    teacher: {
      id: teacherId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      admission_number: input.admission_number,
      school_id: schoolId,
      school_name: context.school.name,
      subject_id: context.subject.id,
      subject_name: context.subject.subject_name,
      profile_photo: uploaded.url,
      class_teacher: true,
      class_labels: [formatClassLabel(context.klass)],
      status: "active",
    },
  };
}
