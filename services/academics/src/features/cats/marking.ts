import type { AssessmentQuestion, CalcSpec } from "./types";

const MAX_RESPONSE_LENGTH = 5000;

/** Marks multiple choice, reorder and calculation answers; returns null when a teacher must mark. All-or-nothing per question. */
export function autoMark(question: Pick<AssessmentQuestion, "type" | "marks" | "answerKey">, spec: Pick<CalcSpec, "expectedValue" | "tolerance"> | undefined, response: unknown): number | null {
  switch (question.type) {
    case "multiple_choice":
      return response === question.answerKey ? question.marks : 0;
    case "reorder": {
      const key = question.answerKey as string[];
      const ok = Array.isArray(response) && response.length === key.length && response.every((id, i) => id === key[i]);
      return ok ? question.marks : 0;
    }
    case "calculation": {
      const value = typeof response === "number" ? response : Number(String(response).trim());
      if (!spec || !Number.isFinite(value) || String(response).trim() === "") return 0;
      return Math.abs(value - spec.expectedValue) <= spec.tolerance ? question.marks : 0;
    }
    default:
      return null;
  }
}

/** Returns an error message when a response has the wrong shape for its question type, else undefined. */
export function responseProblem(question: Pick<AssessmentQuestion, "type" | "choices">, response: unknown): string | undefined {
  const ids = (question.choices ?? []).map((c) => c.id);
  switch (question.type) {
    case "multiple_choice":
      return typeof response === "string" && ids.includes(response) ? undefined : "response must be one of the choice ids";
    case "reorder": {
      const ok = Array.isArray(response) && response.length === ids.length && new Set(response).size === ids.length && response.every((r) => ids.includes(r as string));
      return ok ? undefined : "response must list every choice id once";
    }
    case "calculation":
      return (typeof response === "number" && Number.isFinite(response)) || (typeof response === "string" && response.trim() !== "" && Number.isFinite(Number(response)))
        ? undefined
        : "response must be a number";
    default:
      return typeof response === "string" && response.length <= MAX_RESPONSE_LENGTH ? undefined : "response must be text";
  }
}

/** Student-safe question: no keys, and choices sorted by random id so a reorder list never reveals the answer. */
export function studentQuestion(q: AssessmentQuestion) {
  const choices = q.choices ? [...q.choices].sort((a, b) => a.id.localeCompare(b.id)) : undefined;
  return { id: q.id, position: q.position, type: q.type, stem: q.stem, marks: q.marks, ...(choices ? { choices } : {}) };
}
