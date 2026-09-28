// =============================================================================
// Subjects — WRITE services.
// -----------------------------------------------------------------------------
// The route handlers under app/api/subjects/** validate the request (zod) and call
// these functions; nothing here knows about HTTP. Rules every function follows:
//
//   * The school comes from the session and is passed in. Ids picked from a form
//     (class offering, topic, resource, teacher) are re-checked against that school
//     before they are used, so another school's id can never be read or changed.
//   * Database work goes through lib/repositories/subject.repo.ts (Prisma, one
//     transaction per multi-table write). Files go through lib/storage.ts; a file we
//     uploaded but can no longer use is removed again.
//   * Expected problems throw ApiError with a DOMAIN_CONDITION code and a message safe
//     to show. Anything else is a bug: it is thrown as a plain Error and the route
//     turns it into a generic 500 (raw database text is never sent to the client).
// =============================================================================

import { ApiError, badRequest } from "@/lib/api/errors";
import {
  SUBJECT_BACKGROUND_BUCKET,
  SUBJECT_RESOURCES_BUCKET,
} from "@/lib/subjects";
import {
  createAssessmentWithTargets,
  createSubjectOffering as createOfferingRows,
  findCurriculumNode,
  findClassLinks,
  findResourceInOffering,
  findTeacherInSchool,
  insertCurriculumNode,
  insertResource,
  isSubjectSharedWithOtherSchools,
  masterSubjectExists,
  updateResourceVisibility,
  upsertClassProgress,
} from "@/lib/repositories/subject.repo";
import { resourceNotFound, subjectNotFound, topicInvalid } from "@/lib/subjects-errors";
import { buildSubjectResourcePath, getClassOfferingOrThrow } from "@/lib/subjects-server";
import { getPublicUrl, removeFiles, uploadFile } from "@/lib/storage";
import {
  BACKGROUND_MAX_BYTES,
  RESOURCE_MAX_BYTES,
  checkBackgroundImage,
  checkResourceFile,
  isUuid,
  toDateOrNull,
  type CreateAssessmentInput,
  type CreateResourceInput,
  type CreateSubjectInput,
  type CreateTopicInput,
  type ToggleVisibilityInput,
  type UpdateProgressInput,
} from "@/lib/validation/subjects";

/** Who is acting. Both values come from the session, never from the request body. */
export type ActorContext = { schoolId: string; userId: string };

/** users.id is a uuid; a non-uuid actor id (another auth provider) is stored as null instead of failing the insert. */
function actorIdOrNull(userId: string): string | null {
  return isUuid(userId) ? userId : null;
}

/** A storage failure: log the provider's message, show a friendly one. */
function uploadFailed(providerMessage: string): ApiError {
  console.error("[subjects] file storage failed:", providerMessage);
  return new ApiError(500, "The file couldn't be uploaded. Please try again.", { code: "SUBJECT_UPLOAD_FAILED" });
}

/** Best-effort removal of an object we uploaded but can no longer use. Failure is logged, not thrown. */
async function removeOrphan(bucket: string, path: string | null) {
  if (!path) return;
  const { error } = await removeFiles(bucket, [path]);
  if (error) console.error(`[subjects] could not remove orphaned upload ${bucket}/${path}:`, error);
}

// ---------------------------------------------------------------------------
// Create a subject offering (POST /api/subjects)
// ---------------------------------------------------------------------------

export type CreatedSubjectOffering = { id: string; subject_id: number; school_id: string };

/**
 * Create (or link) a master subject and connect it to this school, its classes and teachers.
 *
 * Why it exists: the "Add Subject" form does four things at once: pick/create the shared
 * subject, create the school's offering of it, link classes, assign teachers.
 *
 * @param input           validated payload (see createSubjectSchema)
 * @param actor           school + user from the session
 * @param backgroundImage optional uploaded background image (checked here)
 * @throws ApiError 400 (bad image / missing name), 404 (unknown existing subject),
 *         409 (duplicate name/code, or a shared subject's image can't be changed)
 */
export async function createSubjectOffering(
  input: CreateSubjectInput,
  actor: ActorContext,
  backgroundImage: File | null,
): Promise<CreatedSubjectOffering> {
  const { schoolId } = actor;
  const existingSubjectId = input.existing_subject_id;

  let imageExtension: string | null = null;
  if (backgroundImage) {
    const check = checkBackgroundImage(backgroundImage);
    if (!check.ok) throw new ApiError(400, check.message, { code: "SUBJECT_IMAGE_INVALID" });
    imageExtension = check.extension;
  }

  if (existingSubjectId) {
    if (!(await masterSubjectExists(existingSubjectId))) throw subjectNotFound("Subject not found.");

    // The master subject is shared by every school. One school must not rewrite its
    // background, so only allow it while no other school offers this subject.
    if ((backgroundImage || input.abstract_image_url != null) && (await isSubjectSharedWithOtherSchools(existingSubjectId, schoolId))) {
      throw new ApiError(
        409,
        "This subject is shared with other schools, so its background image can't be changed here.",
        { code: "SUBJECT_SHARED" },
      );
    }
  } else if (!input.subject_name) {
    throw badRequest("Either an existing subject or a subject name is required.");
  }

  let backgroundImageUrl = input.abstract_image_url;
  let uploadedPath: string | null = null;
  if (backgroundImage && imageExtension) {
    uploadedPath = `subjects/${schoolId}/${existingSubjectId ?? "draft"}/${Date.now()}-${crypto.randomUUID()}.${imageExtension}`;
    const uploaded = await uploadFile(SUBJECT_BACKGROUND_BUCKET, uploadedPath, await backgroundImage.arrayBuffer(), {
      contentType: backgroundImage.type,
      ensureBucket: { public: true, fileSizeLimit: BACKGROUND_MAX_BYTES },
    });
    if (uploaded.error) throw uploadFailed(uploaded.error);
    backgroundImageUrl = getPublicUrl(SUBJECT_BACKGROUND_BUCKET, uploadedPath);
  }

  try {
    const created = await createOfferingRows({
      schoolId,
      existingSubjectId,
      newSubject: existingSubjectId
        ? null
        : {
            subject_name: input.subject_name as string,
            subject_code: input.subject_code,
            acronym: input.acronym,
            short_name: input.short_name,
            strapline: input.strapline,
            description: input.description,
            department: input.department,
            category: input.category,
            subject_type: input.subject_type,
            education_level: input.education_level,
            requires_lab: input.requires_lab,
            has_coursework: input.has_coursework,
            has_assessments: input.has_assessments,
            is_elective: input.is_elective,
            is_active: input.is_active,
            default_sequence: input.default_sequence,
            theme_token: input.theme_token,
          },
      backgroundImageUrl,
      classIds: input.class_ids,
      teacherAssignments: input.teacher_assignments,
    });
    return { ...created, school_id: schoolId };
  } catch (error) {
    // The transaction rolled back, so the image we uploaded is now unused.
    await removeOrphan(SUBJECT_BACKGROUND_BUCKET, uploadedPath);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Assessments (POST /api/subjects/[id]/assessments)
// ---------------------------------------------------------------------------

/**
 * Schedule an assessment for a subject offering and target it at some of its classes.
 *
 * @param offering the offering (already proven to be the caller's school)
 * @param input    validated payload; title, type and target_class_ids must be present
 * @throws ApiError 400 when the teacher isn't this school's, or none of the chosen
 *         classes is offered for this subject
 */
export async function createAssessment(
  offering: { id: string; school_id: string },
  input: CreateAssessmentInput & { title: string; type: string },
  actor: ActorContext,
): Promise<void> {
  if (input.teacher_id && !(await findTeacherInSchool(input.teacher_id, offering.school_id))) {
    throw new ApiError(400, "The selected teacher doesn't belong to this school.", {
      code: "ASSESSMENT_TEACHER_INVALID",
    });
  }

  // Resolve the class offerings first: an assessment with no targets would be invisible.
  const links = await findClassLinks(offering.id, input.target_class_ids);
  if (links.length === 0) {
    throw new ApiError(400, "None of the selected classes are offered for this subject.", {
      code: "ASSESSMENT_TARGETS_INVALID",
    });
  }

  await createAssessmentWithTargets(
    offering,
    {
      type: input.type,
      title: input.title,
      description: input.description,
      term: input.term,
      total_marks_raw: input.total_marks_raw,
      duration_minutes: input.duration_minutes,
      scheduled_start_at: toDateOrNull(input.scheduled_start_at),
      scheduled_end_at: toDateOrNull(input.scheduled_end_at),
      created_by: actorIdOrNull(actor.userId),
      teacher_id: input.teacher_id,
    },
    links,
  );
}

// ---------------------------------------------------------------------------
// Coursework (POST/PATCH /api/subjects/[id]/coursework)
// ---------------------------------------------------------------------------

/** A topic picked from a form must be part of the SAME class offering. */
async function requireNodeInClassOffering(nodeId: string, classOfferingId: string, message: string) {
  const node = await findCurriculumNode(nodeId, classOfferingId);
  if (!node) throw topicInvalid(message);
  return node;
}

/**
 * Add a topic/subtopic to a class offering's curriculum tree.
 *
 * @throws ApiError 404 when the class offering isn't part of this subject,
 *         400 when the parent topic isn't in that class offering
 */
export async function createCurriculumNode(
  offering: { id: string },
  input: CreateTopicInput & { school_subject_class_id: string; title: string },
): Promise<void> {
  await getClassOfferingOrThrow(offering.id, input.school_subject_class_id);

  let depth = 0;
  if (input.parent_id) {
    const parent = await requireNodeInClassOffering(
      input.parent_id,
      input.school_subject_class_id,
      "The parent topic isn't part of this class.",
    );
    depth = Number(parent.depth ?? 0) + 1;
  }

  await insertCurriculumNode({
    school_subject_class_id: input.school_subject_class_id,
    parent_id: input.parent_id,
    title: input.title,
    node_type: input.node_type,
    sort_order: input.sort_order,
    depth,
  });
}

/**
 * Add a resource (uploaded file and/or link) to a class offering.
 *
 * @param file the uploaded file, or null for a link-only resource (size 0 counts as none)
 * @throws ApiError 404 (class offering), 400 (bad file, topic not in class, neither
 *         file nor link given)
 */
export async function createResource(
  offering: { id: string; school_id: string; subject_id: number },
  input: CreateResourceInput & { school_subject_class_id: string; title: string },
  file: File | null,
  actor: ActorContext,
): Promise<void> {
  const classLink = await getClassOfferingOrThrow(offering.id, input.school_subject_class_id);

  if (input.curriculum_node_id) {
    await requireNodeInClassOffering(
      input.curriculum_node_id,
      input.school_subject_class_id,
      "The selected topic isn't part of this class.",
    );
  }

  const hasFile = file !== null && file.size > 0;
  if (!hasFile && !input.source_url) {
    throw new ApiError(400, "Attach a file or provide a source URL.", { code: "RESOURCE_SOURCE_REQUIRED" });
  }

  let storagePath: string | null = null;
  if (hasFile) {
    const check = checkResourceFile(file);
    if (!check.ok) throw new ApiError(400, check.message, { code: "RESOURCE_FILE_INVALID" });

    storagePath = buildSubjectResourcePath({
      schoolId: offering.school_id,
      subjectId: offering.subject_id,
      classId: classLink.class_id,
      filename: check.safeName,
    });
    const upload = await uploadFile(SUBJECT_RESOURCES_BUCKET, storagePath, await file.arrayBuffer(), {
      contentType: check.contentType,
      ensureBucket: { public: false, fileSizeLimit: RESOURCE_MAX_BYTES },
    });
    if (upload.error) throw uploadFailed(upload.error);
  }

  try {
    await insertResource({
      school_subject_class_id: input.school_subject_class_id,
      curriculum_node_id: input.curriculum_node_id,
      resource_type: input.resource_type,
      title: input.title,
      short_description: input.short_description,
      author_name: input.author_name,
      cover_image_url: input.cover_image_url,
      storage_path: storagePath,
      source_url: input.source_url,
      visibility: input.visibility,
      uploaded_by: actorIdOrNull(actor.userId),
    });
  } catch (error) {
    await removeOrphan(SUBJECT_RESOURCES_BUCKET, storagePath);
    throw error;
  }
}

/**
 * Switch a resource between private and public and record it in the visibility history.
 *
 * @throws ApiError 404 (SUBJECT_RESOURCE_NOT_FOUND) when the resource isn't in this subject offering
 */
export async function setResourceVisibility(
  offering: { id: string },
  input: ToggleVisibilityInput,
  actor: ActorContext,
): Promise<void> {
  // Looked up THROUGH this offering, so another subject's (or school's) resource is a 404.
  const resource = await findResourceInOffering(offering.id, input.resource_id);
  if (!resource) throw resourceNotFound();

  if (resource.visibility === input.next_visibility) return; // nothing to change, nothing to record
  await updateResourceVisibility(resource.id, resource.visibility, input.next_visibility, actorIdOrNull(actor.userId));
}

/**
 * Save a class offering's syllabus progress (current topic + percentage covered).
 *
 * @throws ApiError 404 (class offering not ours), 400 (current topic not in that class)
 */
export async function saveClassProgress(offering: { id: string }, input: UpdateProgressInput): Promise<void> {
  await getClassOfferingOrThrow(offering.id, input.school_subject_class_id);

  if (input.current_node_id) {
    await requireNodeInClassOffering(
      input.current_node_id,
      input.school_subject_class_id,
      "The current topic isn't part of this class.",
    );
  }

  await upsertClassProgress(input.school_subject_class_id, input.current_node_id, input.syllabus_progress_pct);
}
