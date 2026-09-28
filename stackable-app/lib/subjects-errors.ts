// =============================================================================
// Subjects — domain errors.
// -----------------------------------------------------------------------------
// One small file so the repository, the services and the routes all raise the SAME
// errors with the SAME machine-readable codes (DOMAIN_CONDITION). The UI switches on
// these codes (see SUBJECT_ERROR_CODES in hooks/useSubjects.ts).
// =============================================================================

import { ApiError } from "@/lib/api/errors";

/** 404 for a subject offering that is missing, malformed or belongs to another school. */
export const subjectNotFound = (message = "Subject offering not found.") =>
  new ApiError(404, message, { code: "SUBJECT_NOT_FOUND" });

/** 404 for a class offering (school_subject_classes row) that is not part of this subject. */
export const classOfferingNotFound = (message = "Class offering not found.") =>
  new ApiError(404, message, { code: "SUBJECT_CLASS_NOT_FOUND" });

/** 404 for a resource that is not part of this subject offering. */
export const resourceNotFound = (message = "Resource not found.") =>
  new ApiError(404, message, { code: "SUBJECT_RESOURCE_NOT_FOUND" });

/** 409 when a subject with the same name or code already exists in the shared catalogue. */
export const subjectDuplicate = () =>
  new ApiError(
    409,
    "A subject with that name or code already exists. Pick it from “Use existing subject”.",
    { code: "SUBJECT_DUPLICATE" },
  );

/** 400 for a topic (parent / current / linked) that is not part of the chosen class offering. */
export const topicInvalid = (message: string) =>
  new ApiError(400, message, { code: "SUBJECT_TOPIC_INVALID" });
