import type { Pool } from "pg";
import { createService, errors, requireServiceToken, type ReadyCheck } from "@stackable/service-kit";
// hono is not a direct dependency, so the context type is borrowed from the middleware signature.
type Ctx = Parameters<ReturnType<typeof requireServiceToken>>[0];
import type { AiProvider } from "./provider";
import { AiService, type Actor, type ToolKind } from "./service";
import type { Store } from "./store";
import { Validator } from "./validate";

export const SERVICE_NAME = "ai";

const QUESTION_ID_MAX = 100;
const QUESTION_TEXT_MAX = 4000;
const STUDENT_MESSAGE_MAX = 2000;
const ANSWER_MAX = 500;
const STUDY_TEXT_MAX = 8000;
const TOOL_COUNT_MAX = 20;
const TOOL_COUNT_DEFAULT = 5;
const TOOL_KINDS: readonly ToolKind[] = ["flashcards", "summary", "quiz"];

export interface AppDeps {
  store: Store;
  provider: AiProvider;
  /** Optional so dev can run on the in-memory store without a database. */
  pool?: Pool;
  version: string;
  now?: () => Date;
}

async function readBody(c: Ctx): Promise<Validator> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw errors.validation("Malformed JSON body");
  }
  return Validator.from(raw);
}

function actorOf(c: Ctx): Actor {
  const claims = c.var.claims;
  return { schoolId: claims.schoolId, userId: claims.sub, role: claims.role };
}

/** Builds the ai app: validation and role checks here, rules in AiService. */
export function buildApp({ store, provider, pool, version, now }: AppDeps) {
  const service = new AiService(store, provider, now);
  const checks: ReadyCheck[] = [
    pool
      ? { name: "database", run: () => pool.query("select 1") }
      : { name: "database", required: false, run: () => Promise.reject(new Error("DATABASE_URL not set")) },
    {
      name: "provider",
      required: false,
      run: () => (provider.enabled ? Promise.resolve() : Promise.reject(new Error(`${provider.name} disabled`))),
    },
  ];
  const app = createService({ name: SERVICE_NAME, version, checks });
  const guard = requireServiceToken(SERVICE_NAME);

  app.post("/v1/tutor/hint", guard, async (c) => {
    const v = await readBody(c);
    const input = {
      questionId: v.string("questionId", QUESTION_ID_MAX),
      questionText: v.string("questionText", QUESTION_TEXT_MAX),
      answerState: v.oneOf("answerState", ["UNANSWERED", "WRONG"] as const, "UNANSWERED"),
      helpsUsed: v.int("helpsUsed", 0, 100, 0),
      studentMessage: v.optionalString("studentMessage", STUDENT_MESSAGE_MAX),
      answerKey: v.optionalString("answerKey", ANSWER_MAX),
      studentId: v.optionalString("studentId", QUESTION_ID_MAX),
    };
    v.done();
    return c.json(await service.requestHint(actorOf(c), input));
  });

  app.post("/v1/tutor/practice", guard, async (c) => {
    const v = await readBody(c);
    const input = {
      questionId: v.string("questionId", QUESTION_ID_MAX),
      questionText: v.string("questionText", QUESTION_TEXT_MAX),
      difficulty: v.has("difficulty") ? v.int("difficulty", 1, 5, 3) : undefined,
      studentId: v.optionalString("studentId", QUESTION_ID_MAX),
    };
    v.done();
    return c.json(await service.createPractice(actorOf(c), input));
  });

  app.post("/v1/gate/answer", guard, async (c) => {
    const v = await readBody(c);
    const input = {
      questionId: v.string("questionId", QUESTION_ID_MAX),
      correct: v.has("correct") ? v.bool("correct") : undefined,
      practiceAnswer: v.optionalString("practiceAnswer", ANSWER_MAX),
      studentId: v.optionalString("studentId", QUESTION_ID_MAX),
    };
    v.done();
    return c.json(await service.submitAnswer(actorOf(c), input));
  });

  app.get("/v1/usage/summary", guard, async (c) => {
    const studentId = c.req.query("studentId");
    if (!studentId || studentId.length > QUESTION_ID_MAX) {
      throw errors.validation("Request validation failed", {
        fields: [{ path: "studentId", message: "is required" }],
      });
    }
    return c.json(await service.usageSummary(actorOf(c), studentId));
  });

  app.post("/v1/tools/:kind", guard, async (c) => {
    const kind = c.req.param("kind") as ToolKind;
    if (!TOOL_KINDS.includes(kind)) throw errors.notFound("Unknown study tool");
    const v = await readBody(c);
    const input = {
      text: v.string("text", STUDY_TEXT_MAX),
      count: v.int("count", 1, TOOL_COUNT_MAX, TOOL_COUNT_DEFAULT),
      studentId: v.optionalString("studentId", QUESTION_ID_MAX),
    };
    v.done();
    return c.json(await service.runTool(actorOf(c), kind, input));
  });

  return app;
}
