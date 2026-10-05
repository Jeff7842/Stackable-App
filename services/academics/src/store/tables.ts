import type { Row, OutboxRow, Repo, TableDef } from "./types";
import type {
  Answer, Assignment, AssignmentItem, ParentReview, Question, QuestionOption, ReviewDecision, Submission,
} from "../features/homework/types";
import type {
  Accommodation, Assessment, AssessmentQuestion, Attempt, AttemptAnswer, CalcSpec, PaperScan,
} from "../features/cats/types";
import type { AssessmentResult, GradeBand, GradingSystem, PassMark } from "../features/grading/types";

function table<T extends Row>(name: string, keys: readonly (keyof T & string)[], json: readonly (keyof T & string)[] = []): TableDef<T> {
  return { name, keys, json };
}

/** Every table in the academics schema; the migration test keeps these keys equal to the SQL columns. */
export const TABLES = {
  questions: table<Question>("questions", ["id", "schoolId", "type", "stem", "marks", "answerKey", "createdBy", "createdAt", "updatedAt"]),
  questionOptions: table<QuestionOption>("question_options", ["id", "schoolId", "questionId", "position", "label", "isCorrect", "createdAt"]),
  assignments: table<Assignment>("assignments", ["id", "schoolId", "classId", "subjectId", "teacherId", "title", "dueAt", "closesAt", "status", "createdAt", "updatedAt"]),
  assignmentItems: table<AssignmentItem>("assignment_items", ["id", "schoolId", "assignmentId", "questionId", "position", "marks", "createdAt"]),
  submissions: table<Submission>("assignment_submissions", ["id", "schoolId", "assignmentId", "studentId", "status", "submittedAt", "late", "createdAt", "updatedAt"]),
  answers: table<Answer>("answers", ["id", "schoolId", "submissionId", "itemId", "responseText", "selectedOptionId", "marksAwarded", "aiGateLocked", "createdAt", "updatedAt"]),
  reviewDecisions: table<ReviewDecision>("review_decisions", ["id", "schoolId", "submissionId", "decision", "reason", "reviewerId", "createdAt"]),
  parentReviews: table<ParentReview>("parent_reviews", ["id", "schoolId", "submissionId", "parentId", "acknowledged", "comment", "createdAt"]),
  outbox: table<OutboxRow>("outbox", ["id", "schoolId", "topic", "payload", "createdAt", "publishedAt"], ["payload"]),
  assessments: table<Assessment>("assessments", ["id", "schoolId", "title", "type", "classId", "subjectId", "teacherId", "durationMinutes", "opensAt", "closesAt", "status", "createdAt", "updatedAt"]),
  assessmentQuestions: table<AssessmentQuestion>("assessment_questions", ["id", "schoolId", "assessmentId", "position", "type", "stem", "marks", "choices", "answerKey", "createdAt"], ["choices", "answerKey"]),
  calcSpecs: table<CalcSpec>("calc_specs", ["id", "schoolId", "questionId", "expectedValue", "tolerance", "createdAt"]),
  accommodations: table<Accommodation>("assessment_accommodations", ["id", "schoolId", "assessmentId", "studentId", "extraMinutes", "createdAt"]),
  attempts: table<Attempt>("attempts", ["id", "schoolId", "assessmentId", "studentId", "status", "startedAt", "dueAt", "submittedAt", "extraMinutes", "score", "createdAt", "updatedAt"]),
  attemptAnswers: table<AttemptAnswer>("attempt_answers", ["id", "schoolId", "attemptId", "questionId", "response", "marksAwarded", "createdAt", "updatedAt"], ["response"]),
  paperScans: table<PaperScan>("paper_scans", ["id", "schoolId", "attemptId", "objectKey", "createdBy", "createdAt"]),
  gradingSystems: table<GradingSystem>("grading_systems", ["id", "schoolId", "name", "effectiveFrom", "active", "createdAt", "updatedAt"]),
  gradeBands: table<GradeBand>("grade_bands", ["id", "schoolId", "systemId", "minPct", "maxPct", "grade", "points", "remark", "createdAt"]),
  passMarks: table<PassMark>("pass_marks", ["id", "schoolId", "systemId", "subjectId", "passPct", "createdAt"]),
  results: table<AssessmentResult>("assessment_results", ["id", "schoolId", "assessmentId", "studentId", "attemptId", "systemId", "raw", "total", "pct", "grade", "points", "remark", "isPass", "releasedAt", "createdAt", "updatedAt"]),
};

type RowOf<D> = D extends TableDef<infer R> ? R : never;

/** What a service sees inside a transaction: one tenant-scoped repo per table. */
export type Db = { [K in keyof typeof TABLES]: Repo<RowOf<(typeof TABLES)[K]>> };

export function buildDb(make: <R extends Row>(def: TableDef<R>) => Repo<R>): Db {
  const entries = Object.entries(TABLES).map(([key, def]) => [key, make(def as unknown as TableDef<Row>)]);
  return Object.fromEntries(entries) as Db;
}

export interface Store {
  /** Runs fn in one transaction scoped to a school; a throw rolls back every write. */
  tx<T>(schoolId: string, fn: (db: Db) => Promise<T>): Promise<T>;
  /** Schools that have in-progress attempts past their deadline; the only cross-tenant read. */
  dueSchoolIds(now: Date): Promise<string[]>;
}
