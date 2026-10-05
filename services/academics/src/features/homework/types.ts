export const ASSIGNMENT_STATUSES = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const;
export const QUESTION_TYPES = ["short_answer", "multiple_choice", "research"] as const;
export const SUBMISSION_STATUSES = ["IN_PROGRESS", "SUBMITTED", "APPROVED", "RETURNED", "REJECTED", "MISSED"] as const;
export const REVIEW_DECISIONS = ["APPROVED", "RETURNED", "REJECTED"] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type HomeworkQuestionType = (typeof QUESTION_TYPES)[number];
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export type ReviewDecisionValue = (typeof REVIEW_DECISIONS)[number];

export interface Question {
  id: string;
  schoolId: string;
  type: HomeworkQuestionType;
  stem: string;
  marks: number;
  answerKey: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  schoolId: string;
  questionId: string;
  position: number;
  label: string;
  isCorrect: boolean;
  createdAt: string;
}

export interface Assignment {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  dueAt: string;
  closesAt: string;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentItem {
  id: string;
  schoolId: string;
  assignmentId: string;
  questionId: string;
  position: number;
  marks: number;
  createdAt: string;
}

export interface Submission {
  id: string;
  schoolId: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  late: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  id: string;
  schoolId: string;
  submissionId: string;
  itemId: string;
  responseText: string | null;
  selectedOptionId: string | null;
  marksAwarded: number | null;
  aiGateLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewDecision {
  id: string;
  schoolId: string;
  submissionId: string;
  decision: ReviewDecisionValue;
  reason: string | null;
  reviewerId: string;
  createdAt: string;
}

export interface ParentReview {
  id: string;
  schoolId: string;
  submissionId: string;
  parentId: string;
  acknowledged: boolean;
  comment: string | null;
  createdAt: string;
}
