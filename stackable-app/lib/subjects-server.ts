// =============================================================================
// Subjects — server-side READ service + shared route settings.
// -----------------------------------------------------------------------------
// Sits between the API routes and lib/repositories/subject.repo.ts (Prisma):
//   * proves the subject offering in the URL belongs to the caller's school (a
//     foreign or malformed id is a 404, exactly like one that does not exist),
//   * holds the roles / cache settings the /api/subjects routes share (route.ts
//     files may not export anything except HTTP handlers, so they live here),
//   * builds storage paths for uploaded resources.
// The writes live in lib/subjects-mutations.ts.
// =============================================================================

import type { Role } from "@/lib/validation/shared";
import { isUuid, sanitizeFileName } from "@/lib/validation/subjects";
import type {
  SubjectAssessmentsPayload,
  SubjectCourseworkPayload,
  SubjectDetailPayload,
} from "@/lib/subjects";
import { classOfferingNotFound, subjectNotFound } from "@/lib/subjects-errors";
import type { OfferingRow } from "@/lib/subjects-payloads";
import {
  findClassOffering,
  findOffering,
  findResourceVisibilityByPath,
  getSubjectAssessments,
  getSubjectCoursework,
  getSubjectDetail,
} from "@/lib/repositories/subject.repo";

export { classOfferingNotFound, subjectNotFound } from "@/lib/subjects-errors";
export { createSignedResourceUrl } from "@/lib/subjects-payloads";

// ---------------------------------------------------------------------------
// Access rules + cache settings shared by the /api/subjects routes
// ---------------------------------------------------------------------------

/** Who may read subject data. Students, pupils and parents are not in this list on purpose:
 *  the detail payload carries every enrolled student's name and marks. */
export const SUBJECT_READ_ROLES: Role[] = ["admin", "super-admin", "manager", "teacher", "staff"];

/** Who may create or change subject data. */
export const SUBJECT_WRITE_ROLES: Role[] = ["admin", "super-admin", "manager", "teacher"];

export const SUBJECT_CACHE_ENTITY = "subjects";
// Seconds. Every write bumps the school's cache version, so these only bound how stale a
// read can be after a change made elsewhere (e.g. a new master subject seen by other schools).
export const SUBJECT_LIST_TTL_SECONDS = 30;
export const SUBJECT_DETAIL_TTL_SECONDS = 60;
export const SUBJECT_ASSESSMENTS_TTL_SECONDS = 30; // upcoming/past and progress depend on "now"
export const SUBJECT_COURSEWORK_TTL_SECONDS = 60;

/** The offering id from a URL, or a 404 when it isn't even shaped like an id (also keeps cache keys short). */
export function requireSubjectId(id: string): string {
  if (!isUuid(id)) throw subjectNotFound();
  return id;
}

// ---------------------------------------------------------------------------
// Ownership checks
// ---------------------------------------------------------------------------

/**
 * Load one subject offering of THIS school.
 * @throws ApiError 404 (SUBJECT_NOT_FOUND) when the id is malformed, missing or another school's.
 */
export async function getSchoolSubjectOrThrow(schoolSubjectId: string, schoolId: string): Promise<OfferingRow> {
  if (!isUuid(schoolSubjectId)) throw subjectNotFound();
  const offering = await findOffering(schoolSubjectId, schoolId);
  if (!offering) throw subjectNotFound();
  return offering;
}

/**
 * Prove a class offering (school_subject_classes row) belongs to this subject offering.
 * Why: an id picked from a form could point at another school's class; the subject offering
 * is already known to be ours, so "belongs to it" means "is ours".
 * @throws ApiError 404 (SUBJECT_CLASS_NOT_FOUND) when it is not part of this offering.
 */
export async function getClassOfferingOrThrow(schoolSubjectId: string, classOfferingId: string) {
  const row = await findClassOffering(schoolSubjectId, classOfferingId);
  if (!row) throw classOfferingNotFound();
  return row;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Detail payload for one offering of this school. @throws ApiError 404 when it is not ours. */
export async function getSubjectDetailData(schoolSubjectId: string, schoolId: string): Promise<SubjectDetailPayload> {
  return getSubjectDetail(await getSchoolSubjectOrThrow(schoolSubjectId, schoolId));
}

/** Upcoming + past assessments for one offering of this school. @throws ApiError 404 when it is not ours. */
export async function getSubjectAssessmentsData(
  schoolSubjectId: string,
  schoolId: string,
): Promise<SubjectAssessmentsPayload> {
  return getSubjectAssessments(await getSchoolSubjectOrThrow(schoolSubjectId, schoolId));
}

/**
 * Coursework for one offering of this school. With `classOfferingId`, only that class
 * offering's tree and resources are returned (classOfferings still lists all).
 * @throws ApiError 404 when the offering, or the class offering, is not ours.
 */
export async function getSubjectCourseworkData(
  schoolSubjectId: string,
  schoolId: string,
  classOfferingId?: string | null,
): Promise<SubjectCourseworkPayload> {
  const offering = await getSchoolSubjectOrThrow(schoolSubjectId, schoolId);
  const payload = await getSubjectCoursework(offering, classOfferingId);
  if (!payload) throw classOfferingNotFound();
  return payload;
}

// ---------------------------------------------------------------------------
// Resource files
// ---------------------------------------------------------------------------

// Resource files are stored as {schoolId}/{subjectId}/{classId}/{timestamp}-{random}-{name}.
const RESOURCE_PATH_PATTERN =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/\d{1,12}\/[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]{1,200}$/;

/**
 * Is this storage path one of THIS school's resource files?
 * Why: the download proxy signs any path it is given, so the path must have the
 * exact shape we generate and start with the caller's own school id.
 */
export function isOwnResourcePath(path: string, schoolId: string): boolean {
  const match = RESOURCE_PATH_PATTERN.exec(path);
  return Boolean(match) && match![1].toLowerCase() === schoolId.toLowerCase();
}

/** "private" | "public" for the resource stored at this path in THIS school, or null when there is none. */
export function getResourceVisibilityByPath(storagePath: string, schoolId: string): Promise<string | null> {
  return findResourceVisibilityByPath(storagePath, schoolId);
}

/**
 * Storage path for an uploaded resource: {school}/{subject}/{class}/{time}-{random}-{name}.
 * The name is sanitised (no slashes, no dot-only names, capped length) and the school
 * comes first because the download proxy checks that segment against the session.
 */
export function buildSubjectResourcePath(args: {
  schoolId: string;
  subjectId: number;
  classId: string;
  filename: string;
}) {
  const { safeName } = sanitizeFileName(args.filename);
  const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `${args.schoolId}/${args.subjectId}/${args.classId}/${unique}-${safeName}`;
}
