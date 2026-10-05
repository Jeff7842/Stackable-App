import { AppError, createLogger, errors, type Logger } from "@stackable/service-kit";
import { allowanceStatus, dailyLimit, dayWindow, type Allowance } from "./allowance";
import { locked, OPEN_STATE, transition, type GateAward } from "./gate";
import { DEFAULT_POLICY, type AiPolicy } from "./policy";
import { pointsFor } from "./points";
import type { AiProvider, CompleteInput, CompletionPurpose } from "./provider";
import type { PracticeItem, Session, Store } from "./store";
import { answersMatch, checkNoAnswerLeak, normalize, rewriteRequest, SAFE_FALLBACK_HINT } from "./tutorGuard";

export interface Actor {
  schoolId: string;
  userId: string;
  role: string | undefined;
}

export type ToolKind = "flashcards" | "summary" | "quiz";

export interface HintInput {
  questionId: string;
  questionText: string;
  answerState: "UNANSWERED" | "WRONG";
  helpsUsed?: number;
  studentMessage?: string;
  answerKey?: string;
  studentId?: string;
}

const STUDENT_ROLES = ["student", "pupil"];
const KEY_ROLES = ["teacher", "system"]; // only these may send an answer key or a verdict
const HINT_MAX_TOKENS = 300;
const GENERATE_MAX_TOKENS = 1500;
const GENERATION_ATTEMPTS = 2; // one regenerate when the first output is unusable
const DEFAULT_DIFFICULTY = 3;
const DIFFICULTY_SPREAD = 1; // practice items may differ from the question by one level
const FRIENDLY_PROVIDER_ERROR = "The study helper is unavailable right now. Please try again in a moment.";

const isKeyRole = (role: string | undefined) => role !== undefined && KEY_ROLES.includes(role);

/** The AI tutor use cases: hints, practice, the answer gate, usage counts and study tools. */
export class AiService {
  private readonly log: Logger = createLogger("ai");

  constructor(
    private readonly store: Store,
    private readonly provider: AiProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Students act as themselves; teachers and the system act for a named student.
  private resolveStudent(actor: Actor, studentId: string | undefined, staffMayOmit = false): string {
    if (actor.role !== undefined && STUDENT_ROLES.includes(actor.role)) {
      if (studentId !== undefined && studentId !== actor.userId) throw errors.forbidden();
      return actor.userId;
    }
    if (!isKeyRole(actor.role)) throw errors.forbidden("This action is for students and teachers");
    if (studentId !== undefined) return studentId;
    if (staffMayOmit) return actor.userId;
    throw errors.validation("studentId is required", { fields: [{ path: "studentId", message: "is required" }] });
  }

  private async policy(schoolId: string): Promise<AiPolicy> {
    return (await this.store.getPolicy(schoolId)) ?? DEFAULT_POLICY;
  }

  private async loadSession(actor: Actor, studentId: string, questionId: string) {
    const existing = await this.store.getSession(actor.schoolId, studentId, questionId);
    const session: Session = existing ?? {
      id: crypto.randomUUID(),
      studentId,
      questionId,
      kind: "tutor",
      state: OPEN_STATE,
      hintsUsed: 0,
      practiceCompleted: false,
      version: 0,
    };
    return { session, existed: existing !== null };
  }

  // Optimistic version check so two tabs cannot both consume the same hint.
  private async saveSession(actor: Actor, session: Session, existed: boolean): Promise<void> {
    const ok = existed
      ? await this.store.saveSession(actor.schoolId, { ...session, version: session.version + 1 }, session.version)
      : await this.store.saveSession(actor.schoolId, session, null);
    if (!ok) throw errors.conflict("This question changed in another window. Please reload.");
  }

  private async checkAllowance(actor: Actor, studentId: string, policy: AiPolicy) {
    const [points, tiers] = await Promise.all([
      this.store.sumPoints(actor.schoolId, studentId),
      this.store.listTiers(actor.schoolId),
    ]);
    const limit = dailyLimit(points, tiers, policy.dailyAllowanceBase);
    const { from, to } = dayWindow(this.now());
    const used = await this.store.countReplies(actor.schoolId, studentId, from, to);
    const before = allowanceStatus(limit, used);
    if (before.status === "EXHAUSTED") {
      throw new AppError(429, "AI_ALLOWANCE_EXHAUSTED", "You have used all your AI help for today. It resets tomorrow.", {
        limit,
      });
    }
    const after: Allowance = allowanceStatus(limit, used + 1);
    return after;
  }

  private async call(input: CompleteInput): Promise<string> {
    try {
      return (await this.provider.complete(input)).text;
    } catch (err) {
      this.log.error("provider failed", { provider: this.provider.name, purpose: input.purpose, err: String(err) });
      throw errors.upstream(FRIENDLY_PROVIDER_ERROR);
    }
  }

  private async record(actor: Actor, sessionId: string, role: "student" | "assistant", content: string, flagged = false) {
    await this.store.addMessage(actor.schoolId, {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
      leakFlagged: flagged,
      createdAt: this.now(),
    });
  }

  // Every reply is leak-checked; a leak is rewritten once, then replaced by a safe hint.
  private async guardedHint(question: string, key: string | undefined, input: CompleteInput) {
    const first = await this.call(input);
    if (checkNoAnswerLeak(first, key).ok) return { text: first, flagged: false };
    this.log.warn("tutor reply leaked the answer; regenerating", { purpose: input.purpose });
    try {
      const second = await this.call({
        ...input,
        purpose: "rewrite",
        messages: [{ role: "user", content: rewriteRequest(question) }],
      });
      if (checkNoAnswerLeak(second, key).ok) return { text: second, flagged: true };
    } catch (err) {
      this.log.warn("rewrite failed; using the safe hint", { err: String(err) });
    }
    return { text: SAFE_FALLBACK_HINT, flagged: true };
  }

  private async currentPracticeItem(actor: Actor, session: Session): Promise<PracticeItem> {
    const items = await this.store.getPracticeItems(actor.schoolId, session.id);
    const done = session.state.kind === "PRACTICE_OPEN" ? session.state.done : 0;
    const item = items[done];
    if (!item) throw errors.conflict("Practice items are missing for this question");
    return item;
  }

  /** Gives one hint, or locks the question when the hint cap would be passed. */
  async requestHint(actor: Actor, input: HintInput) {
    if (input.answerKey !== undefined && !isKeyRole(actor.role)) {
      throw errors.forbidden("An answer key cannot be sent from this path");
    }
    const studentId = this.resolveStudent(actor, input.studentId);
    const policy = await this.policy(actor.schoolId);
    const { session, existed } = await this.loadSession(actor, studentId, input.questionId);

    const result = transition(session.state, { type: "HINT" }, policy);
    if (!result.accepted) {
      throw errors.conflict("AI help is closed for this question. Answer it on your own.", { state: session.state.kind });
    }
    if (result.state.kind === "LOCKED_REDO") {
      await this.saveSession(actor, { ...session, state: result.state }, existed);
      return { hint: null, state: result.state, locked: locked(result.state), allowance: null, leakFlagged: false };
    }

    const allowance = await this.checkAllowance(actor, studentId, policy);
    const practice = session.state.kind === "PRACTICE_OPEN" ? await this.currentPracticeItem(actor, session) : null;
    const questionText = practice ? practice.question : input.questionText;
    const key = practice ? practice.answerKey : input.answerKey;
    const hintNumber = result.state.kind === "ASSISTED" || result.state.kind === "PRACTICE_OPEN" ? result.state.hints : 1;
    const studentNote = input.studentMessage?.trim() || "(no message)";

    const reply = await this.guardedHint(questionText, key, {
      purpose: "hint",
      maxTokens: HINT_MAX_TOKENS,
      system:
        `You are a patient school tutor. This is hint ${hintNumber} of ${policy.hintsPerQuestion}. ` +
        "Give one short hint or guiding question. Never state the final answer and never show a full worked solution.",
      messages: [
        { role: "user", content: `Question: ${questionText}\nStudent status: ${input.answerState}\nStudent says: ${studentNote}` },
      ],
    });

    // The session row goes first because messages reference it.
    await this.saveSession(actor, { ...session, state: result.state, hintsUsed: session.hintsUsed + 1 }, existed);
    await this.record(actor, session.id, "student", input.studentMessage?.trim() || "[hint requested]");
    await this.record(actor, session.id, "assistant", reply.text, reply.flagged);
    return { hint: reply.text, state: result.state, locked: locked(result.state), allowance, leakFlagged: reply.flagged };
  }

  // Reads the first {...} block so fenced or chatty replies still parse.
  private parseJson(text: string): Record<string, unknown> | null {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const parsed: unknown = JSON.parse(text.slice(start, end + 1));
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private async generate<T>(
    purpose: CompletionPurpose,
    system: string,
    user: string,
    extract: (json: Record<string, unknown>) => T | null,
  ): Promise<T> {
    for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
      const text = await this.call({ purpose, system, maxTokens: GENERATE_MAX_TOKENS, messages: [{ role: "user", content: user }] });
      const json = this.parseJson(text);
      const value = json ? extract(json) : null;
      if (value !== null) return value;
      this.log.warn("provider output unusable", { purpose, attempt });
    }
    throw new AppError(502, "AI_OUTPUT_INVALID", FRIENDLY_PROVIDER_ERROR);
  }

  /** Generates the practice set for a helped question and opens it; the keys stay on the server. */
  async createPractice(actor: Actor, input: { questionId: string; questionText: string; difficulty?: number; studentId?: string }) {
    const studentId = this.resolveStudent(actor, input.studentId);
    const policy = await this.policy(actor.schoolId);
    const { session, existed } = await this.loadSession(actor, studentId, input.questionId);
    const count = policy.practiceItems;

    if (session.state.kind === "PRACTICE_OPEN") {
      const items = await this.store.getPracticeItems(actor.schoolId, session.id);
      return { items: items.map(publicItem), state: session.state, locked: true };
    }
    const started = transition(session.state, { type: "START_PRACTICE" }, policy);
    if (!started.accepted) {
      throw errors.conflict("Practice is not required for this question", { state: session.state.kind });
    }

    await this.checkAllowance(actor, studentId, policy);
    const wanted = input.difficulty ?? DEFAULT_DIFFICULTY;
    const seen = new Set([normalize(input.questionText)]);
    const items = await this.generate(
      "practice",
      `Write ${count} new practice questions similar to the student's question, each with its answer. ` +
        `Reply with JSON only: {"items":[{"question":string,"answer":string,"difficulty":1-5}]}. Aim for difficulty ${wanted}.`,
      `Question: ${input.questionText}`,
      (json) => pickPracticeItems(json, count, wanted, new Set(seen)),
    );

    await this.store.savePracticeSet(actor.schoolId, session.id, items);
    await this.record(actor, session.id, "assistant", "[practice set generated]");
    await this.saveSession(actor, { ...session, state: started.state }, existed);
    return { items: items.map(publicItem), state: started.state, locked: locked(started.state) };
  }

  /** Applies one submission result to the gate and awards points when it finishes the question. */
  async submitAnswer(actor: Actor, input: { questionId: string; correct?: boolean; practiceAnswer?: string; studentId?: string }) {
    if (input.correct !== undefined && !isKeyRole(actor.role)) {
      throw errors.forbidden("Only the grading service can report a verdict");
    }
    const studentId = this.resolveStudent(actor, input.studentId);
    const policy = await this.policy(actor.schoolId);
    const { session, existed } = await this.loadSession(actor, studentId, input.questionId);

    let correct: boolean;
    if (session.state.kind === "PRACTICE_OPEN") {
      if (input.practiceAnswer === undefined) throw errors.validation("practiceAnswer is required", { fields: [{ path: "practiceAnswer", message: "is required" }] });
      const item = await this.currentPracticeItem(actor, session);
      correct = answersMatch(input.practiceAnswer, item.answerKey);
    } else {
      if (input.practiceAnswer !== undefined) throw errors.conflict("There is no practice item to answer", { state: session.state.kind });
      if (input.correct === undefined) throw errors.validation("correct is required", { fields: [{ path: "correct", message: "is required" }] });
      correct = input.correct;
    }

    const result = transition(session.state, { type: "ANSWER", correct }, policy);
    if (!result.accepted) {
      throw errors.conflict("This question cannot take an answer right now", { state: session.state.kind });
    }
    await this.saveSession(
      actor,
      { ...session, state: result.state, practiceCompleted: session.practiceCompleted || result.award === "PRACTICE_SET_DONE" },
      existed,
    );
    const pointsAwarded = result.award ? await this.award(actor, studentId, input.questionId, result.award, policy) : 0;
    return { state: result.state, locked: locked(result.state), correct, pointsAwarded };
  }

  private async award(actor: Actor, studentId: string, questionId: string, reason: GateAward, policy: AiPolicy) {
    const points = pointsFor(reason, policy);
    const added = await this.store.appendPoints(actor.schoolId, {
      id: crypto.randomUUID(),
      studentId,
      questionId,
      reason,
      points,
      createdAt: this.now(),
    });
    return added ? points : 0;
  }

  /** Counts only, never message content, so a parent sees effort without seeing the chat. */
  async usageSummary(actor: Actor, studentId: string) {
    if (actor.role === undefined) throw errors.forbidden();
    if (STUDENT_ROLES.includes(actor.role) && studentId !== actor.userId) throw errors.forbidden();
    const [counts, points] = await Promise.all([
      this.store.usageCounts(actor.schoolId, studentId),
      this.store.sumPoints(actor.schoolId, studentId),
    ]);
    return { studentId, ...counts, points };
  }

  /** Runs a study tool; output is flagged AI-generated and needs a teacher before it is published. */
  async runTool(actor: Actor, kind: ToolKind, input: { text: string; count: number; studentId?: string }) {
    const ownerId = this.resolveStudent(actor, input.studentId, true);
    const policy = await this.policy(actor.schoolId);
    await this.checkAllowance(actor, ownerId, policy);
    const withAnswers = isKeyRole(actor.role);
    const content = await this.generate(kind, TOOL_PROMPTS[kind](input.count), `Material:\n${input.text}`, (json) =>
      TOOL_EXTRACTORS[kind](json, withAnswers),
    );

    const session: Session = {
      id: crypto.randomUUID(),
      studentId: ownerId,
      questionId: `tool:${kind}:${crypto.randomUUID()}`,
      kind: "tool",
      state: { kind: "DONE", unaided: false },
      hintsUsed: 0,
      practiceCompleted: false,
      version: 0,
    };
    await this.store.saveSession(actor.schoolId, session, null);
    await this.record(actor, session.id, "assistant", `[${kind} generated]`);
    return { kind, aiGenerated: true, needsTeacherReview: true, content };
  }
}

/** The student-facing view of a practice item; the key is left out on purpose. */
function publicItem(item: PracticeItem) {
  return { id: item.id, position: item.position, question: item.question, difficulty: item.difficulty };
}

// Keeps unique, in-range items; null makes the caller regenerate.
function pickPracticeItems(
  json: Record<string, unknown>,
  count: number,
  wanted: number,
  seen: Set<string>,
): PracticeItem[] | null {
  if (!Array.isArray(json.items)) return null;
  const picked: PracticeItem[] = [];
  for (const raw of json.items as unknown[]) {
    if (picked.length === count) break;
    const r = (raw ?? {}) as Record<string, unknown>;
    const { question, answer, difficulty } = r;
    if (typeof question !== "string" || typeof answer !== "string" || typeof difficulty !== "number") continue;
    if (!question.trim() || !answer.trim() || question.length > 500 || answer.length > 200) continue;
    if (!Number.isInteger(difficulty) || Math.abs(difficulty - wanted) > DIFFICULTY_SPREAD) continue;
    const norm = normalize(question);
    if (seen.has(norm)) continue;
    seen.add(norm);
    picked.push({ id: crypto.randomUUID(), position: picked.length, question, answerKey: answer, difficulty });
  }
  return picked.length === count ? picked : null;
}

const TOOL_PROMPTS: Record<ToolKind, (count: number) => string> = {
  flashcards: (n) => `Make ${n} flashcards from the material. Reply with JSON only: {"cards":[{"front":string,"back":string}]}`,
  summary: () => 'Summarise the material for a student. Reply with JSON only: {"summary":string,"keyPoints":[string]}',
  quiz: (n) =>
    `Write ${n} multiple choice questions from the material. Reply with JSON only: ` +
    '{"questions":[{"question":string,"options":[string],"answerIndex":number}]}',
};

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const TOOL_EXTRACTORS: Record<ToolKind, (json: Record<string, unknown>, withAnswers: boolean) => unknown> = {
  flashcards: (json) => {
    const cards = Array.isArray(json.cards) ? (json.cards as Record<string, unknown>[]) : [];
    const ok = cards.length > 0 && cards.every((c) => isText(c?.front) && isText(c?.back));
    return ok ? cards.map((c) => ({ front: c.front, back: c.back })) : null;
  },
  summary: (json) => {
    const points = json.keyPoints;
    const ok = isText(json.summary) && Array.isArray(points) && points.every(isText);
    return ok ? { summary: json.summary, keyPoints: points } : null;
  },
  quiz: (json, withAnswers) => {
    const qs = Array.isArray(json.questions) ? (json.questions as Record<string, unknown>[]) : [];
    const valid = (q: Record<string, unknown>) =>
      isText(q?.question) &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.every(isText) &&
      Number.isInteger(q.answerIndex) &&
      (q.answerIndex as number) >= 0 &&
      (q.answerIndex as number) < q.options.length;
    if (qs.length === 0 || !qs.every(valid)) return null;
    // Students get the questions only; the key is for the teacher reviewing the quiz.
    return qs.map((q) => ({ question: q.question, options: q.options, ...(withAnswers ? { answerIndex: q.answerIndex } : {}) }));
  },
};

