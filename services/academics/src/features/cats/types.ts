export const ASSESSMENT_TYPES = ["cat", "quiz"] as const; // exams are a separate future module
export const ASSESSMENT_STATUSES = ["DRAFT", "SCHEDULED", "OPEN", "CLOSED", "MARKED", "RELEASED"] as const;
export const CAT_QUESTION_TYPES = ["short_answer", "multiple_choice", "reorder", "calculation"] as const;
export const ATTEMPT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "UNDER_MARKING", "MARKED", "AUTO_SUBMITTED"] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export type CatQuestionType = (typeof CAT_QUESTION_TYPES)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export interface Choice {
  id: string;
  label: string;
}

export interface Assessment {
  id: string;
  schoolId: string;
  title: string;
  type: AssessmentType;
  classId: string;
  subjectId: string | null;
  teacherId: string;
  durationMinutes: number;
  opensAt: string;
  closesAt: string;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentQuestion {
  id: string;
  schoolId: string;
  assessmentId: string;
  position: number;
  type: CatQuestionType;
  stem: string;
  marks: number;
  /** Shown to students; for reorder the stored order is the correct order, so views sort by id. */
  choices: Choice[] | null;
  /** MC: the correct choice id. Reorder: choice ids in order. Short answer: optional model answer. */
  answerKey: unknown;
  createdAt: string;
}

export interface CalcSpec {
  id: string;
  schoolId: string;
  questionId: string;
  expectedValue: number;
  tolerance: number;
  createdAt: string;
}

export interface Accommodation {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  extraMinutes: number;
  createdAt: string;
}

export interface Attempt {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  status: AttemptStatus;
  startedAt: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  extraMinutes: number;
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttemptAnswer {
  id: string;
  schoolId: string;
  attemptId: string;
  questionId: string;
  response: unknown;
  marksAwarded: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperScan {
  id: string;
  schoolId: string;
  attemptId: string;
  objectKey: string;
  createdBy: string;
  createdAt: string;
}
