import type { GateState } from "./gate";
import type { AiPolicy, AllowanceTier } from "./policy";
import type { LedgerEntry } from "./points";

export interface Session {
  id: string;
  studentId: string;
  questionId: string;
  kind: "tutor" | "tool";
  state: GateState;
  hintsUsed: number;
  practiceCompleted: boolean;
  version: number;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: "student" | "assistant";
  content: string;
  leakFlagged: boolean;
  createdAt: Date;
}

/** Practice item with its key; the key stays inside the service and is never returned. */
export interface PracticeItem {
  id: string;
  position: number;
  question: string;
  answerKey: string;
  difficulty: number;
}

export interface UsageCounts {
  questionsHelped: number;
  hintsUsed: number;
  practiceDone: number;
}

/** Every method takes schoolId first; a store never returns another school's rows. */
export interface Store {
  getPolicy(schoolId: string): Promise<AiPolicy | null>;
  listTiers(schoolId: string): Promise<AllowanceTier[]>;
  getSession(schoolId: string, studentId: string, questionId: string): Promise<Session | null>;
  /** Insert when expectedVersion is null, else update if the stored version matches; false on conflict. */
  saveSession(schoolId: string, session: Session, expectedVersion: number | null): Promise<boolean>;
  addMessage(schoolId: string, message: MessageRecord): Promise<void>;
  /** Assistant replies for the student in [from, to); each one is one allowance unit. */
  countReplies(schoolId: string, studentId: string, from: Date, to: Date): Promise<number>;
  savePracticeSet(schoolId: string, sessionId: string, items: PracticeItem[]): Promise<void>;
  getPracticeItems(schoolId: string, sessionId: string): Promise<PracticeItem[]>;
  /** False when the same student, question and reason is already in the ledger. */
  appendPoints(schoolId: string, entry: LedgerEntry): Promise<boolean>;
  sumPoints(schoolId: string, studentId: string): Promise<number>;
  usageCounts(schoolId: string, studentId: string): Promise<UsageCounts>;
}

/** In-memory store for dev and tests; behaves like the pg store, tenant by tenant. */
export class MemoryStore implements Store {
  policies = new Map<string, AiPolicy>();
  tiers = new Map<string, AllowanceTier[]>();
  sessions: (Session & { schoolId: string })[] = [];
  messages: (MessageRecord & { schoolId: string })[] = [];
  practice = new Map<string, PracticeItem[]>();
  ledger: (LedgerEntry & { schoolId: string })[] = [];

  async getPolicy(schoolId: string) {
    return this.policies.get(schoolId) ?? null;
  }

  async listTiers(schoolId: string) {
    return this.tiers.get(schoolId) ?? [];
  }

  async getSession(schoolId: string, studentId: string, questionId: string) {
    const found = this.sessions.find(
      (s) => s.schoolId === schoolId && s.studentId === studentId && s.questionId === questionId,
    );
    return found ? { ...found } : null;
  }

  async saveSession(schoolId: string, session: Session, expectedVersion: number | null) {
    const index = this.sessions.findIndex((s) => s.schoolId === schoolId && s.id === session.id);
    if (expectedVersion === null) {
      if (index >= 0) return false;
      this.sessions.push({ ...session, schoolId });
      return true;
    }
    if (index < 0 || this.sessions[index].version !== expectedVersion) return false;
    this.sessions[index] = { ...session, schoolId };
    return true;
  }

  async addMessage(schoolId: string, message: MessageRecord) {
    this.messages.push({ ...message, schoolId });
  }

  async countReplies(schoolId: string, studentId: string, from: Date, to: Date) {
    const ids = new Set(
      this.sessions.filter((s) => s.schoolId === schoolId && s.studentId === studentId).map((s) => s.id),
    );
    return this.messages.filter(
      (m) =>
        m.schoolId === schoolId &&
        m.role === "assistant" &&
        ids.has(m.sessionId) &&
        m.createdAt >= from &&
        m.createdAt < to,
    ).length;
  }

  async savePracticeSet(schoolId: string, sessionId: string, items: PracticeItem[]) {
    this.practice.set(`${schoolId}:${sessionId}`, items.map((i) => ({ ...i })));
  }

  async getPracticeItems(schoolId: string, sessionId: string) {
    return (this.practice.get(`${schoolId}:${sessionId}`) ?? []).map((i) => ({ ...i }));
  }

  async appendPoints(schoolId: string, entry: LedgerEntry) {
    const exists = this.ledger.some(
      (e) =>
        e.schoolId === schoolId &&
        e.studentId === entry.studentId &&
        e.questionId === entry.questionId &&
        e.reason === entry.reason,
    );
    if (exists) return false;
    this.ledger.push({ ...entry, schoolId });
    return true;
  }

  async sumPoints(schoolId: string, studentId: string) {
    return this.ledger
      .filter((e) => e.schoolId === schoolId && e.studentId === studentId)
      .reduce((sum, e) => sum + e.points, 0);
  }

  async usageCounts(schoolId: string, studentId: string) {
    const mine = this.sessions.filter(
      (s) => s.schoolId === schoolId && s.studentId === studentId && s.kind === "tutor",
    );
    return {
      questionsHelped: mine.filter((s) => s.hintsUsed > 0).length,
      hintsUsed: mine.reduce((sum, s) => sum + s.hintsUsed, 0),
      practiceDone: mine.filter((s) => s.practiceCompleted).length,
    };
  }
}
