export interface GradingSystem {
  id: string;
  schoolId: string;
  name: string;
  effectiveFrom: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GradeBand {
  id: string;
  schoolId: string;
  systemId: string;
  minPct: number;
  maxPct: number;
  grade: string;
  points: number;
  remark: string | null;
  createdAt: string;
}

/** subjectId null is the default pass mark; a row with a subject overrides it. */
export interface PassMark {
  id: string;
  schoolId: string;
  systemId: string;
  subjectId: string | null;
  passPct: number;
  createdAt: string;
}

export interface AssessmentResult {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  attemptId: string;
  systemId: string;
  raw: number;
  total: number;
  pct: number;
  grade: string;
  points: number;
  remark: string | null;
  isPass: boolean;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
