import { array, bool, externalId, int, isoDate, num, object, oneOf, optional, string, any, type Infer } from "../../lib/validate";
import { ASSESSMENT_TYPES, CAT_QUESTION_TYPES } from "./types";

const questionSchema = object({
  type: oneOf(CAT_QUESTION_TYPES),
  stem: string(),
  marks: num({ min: 0.5, max: 1000 }),
  choices: optional(array(object({ label: string({ max: 500 }), isCorrect: bool() }), { min: 2, max: 10 })), // multiple_choice
  items: optional(array(string({ max: 500 }), { min: 2, max: 10 })), // reorder, listed in the correct order
  expectedValue: optional(num()), // calculation
  tolerance: optional(num({ min: 0 })),
  modelAnswer: optional(string()), // short_answer
});

export const createAssessmentSchema = object({
  title: string({ max: 200 }),
  type: oneOf(ASSESSMENT_TYPES),
  classId: externalId(),
  subjectId: optional(externalId()),
  durationMinutes: int({ min: 1, max: 600 }),
  opensAt: isoDate(),
  closesAt: isoDate(),
  questions: array(questionSchema, { min: 1, max: 200 }),
});
export type CreateAssessmentInput = Infer<typeof createAssessmentSchema>;

export const listAssessmentsQuery = object({ classId: optional(externalId()) });
export const accommodationSchema = object({ studentId: externalId(), extraMinutes: int({ min: 1, max: 240 }) });
export const startAttemptSchema = object({ classId: externalId() });
export const saveAnswerSchema = object({ response: any() });

export const markAttemptSchema = object({
  marks: array(object({ questionId: externalId(), marks: num({ min: 0 }) }), { max: 200 }),
  finalise: bool(),
});
