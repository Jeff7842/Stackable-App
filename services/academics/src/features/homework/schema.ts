import { array, bool, externalId, int, isoDate, num, object, oneOf, optional, string, type Infer } from "../../lib/validate";
import { ASSIGNMENT_STATUSES, QUESTION_TYPES, REVIEW_DECISIONS } from "./types";

const itemSchema = object({
  marks: num({ min: 0, max: 1000 }),
  question: object({
    type: oneOf(QUESTION_TYPES),
    stem: string(),
    answerKey: optional(string()),
    options: optional(array(object({ label: string({ max: 500 }), isCorrect: bool() }), { min: 2, max: 10 })),
  }),
});

export const createAssignmentSchema = object({
  title: string({ max: 200 }),
  classId: externalId(),
  subjectId: externalId(),
  dueAt: isoDate(),
  closesAt: isoDate(),
  items: array(itemSchema, { min: 1, max: 100 }),
});
export type CreateAssignmentInput = Infer<typeof createAssignmentSchema>;

export const listAssignmentsQuery = object({ classId: optional(externalId()), status: optional(oneOf(ASSIGNMENT_STATUSES)) });
export const openSubmissionSchema = object({ classId: externalId() });
export const saveAnswerSchema = object({ responseText: optional(string({ max: 10_000 })), selectedOptionId: optional(externalId()) });
export const reviewSchema = object({ decision: oneOf(REVIEW_DECISIONS), reason: optional(string({ min: 0, max: 2000 })) });
export const gateSchema = object({ locked: bool() });
export const parentQuery = object({ aiHints: optional(int({ coerce: true, max: 1000 })), aiPractice: optional(int({ coerce: true, max: 1000 })) });
export const parentReviewSchema = object({ acknowledged: bool(), comment: optional(string({ max: 2000 })) });
