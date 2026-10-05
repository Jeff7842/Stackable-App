import type { AiPolicy } from "./policy";

export type GateState =
  | { kind: "OPEN" }
  | { kind: "ASSISTED"; hints: number }
  | { kind: "PRACTICE_REQUIRED" }
  | { kind: "PRACTICE_OPEN"; done: number; hints: number }
  | { kind: "DONE"; unaided: boolean }
  | { kind: "LOCKED_REDO" };

export type GateEvent = { type: "HINT" } | { type: "ANSWER"; correct: boolean } | { type: "START_PRACTICE" };

export type GateAward = "UNAIDED_CORRECT" | "PRACTICE_SET_DONE";

export interface GateResult {
  state: GateState;
  /** False when the event is not allowed in this state; the state is returned unchanged. */
  accepted: boolean;
  award: GateAward | null;
}

export const OPEN_STATE: GateState = { kind: "OPEN" };

const same = (state: GateState): GateResult => ({ state, accepted: false, award: null });
const moved = (state: GateState, award: GateAward | null = null): GateResult => ({ state, accepted: true, award });

function hint(state: GateState, policy: AiPolicy): GateResult {
  const used = state.kind === "ASSISTED" || state.kind === "PRACTICE_OPEN" ? state.hints : 0;
  // A hint beyond the cap locks the question instead of helping.
  if (state.kind === "OPEN" || state.kind === "ASSISTED" || state.kind === "PRACTICE_OPEN") {
    if (used + 1 > policy.hintsPerQuestion) return moved({ kind: "LOCKED_REDO" });
    if (state.kind === "PRACTICE_OPEN") return moved({ ...state, hints: used + 1 });
    return moved({ kind: "ASSISTED", hints: used + 1 });
  }
  return same(state);
}

function answer(state: GateState, correct: boolean, policy: AiPolicy): GateResult {
  switch (state.kind) {
    case "OPEN":
      return correct ? moved({ kind: "DONE", unaided: true }, "UNAIDED_CORRECT") : moved(state);
    case "ASSISTED":
      return correct ? moved({ kind: "PRACTICE_REQUIRED" }) : moved(state);
    case "PRACTICE_OPEN": {
      if (!correct) return moved(state);
      const done = state.done + 1;
      if (done >= policy.practiceItems) return moved({ kind: "DONE", unaided: false }, "PRACTICE_SET_DONE");
      return moved({ kind: "PRACTICE_OPEN", done, hints: 0 });
    }
    case "LOCKED_REDO":
      // The redo is answered without AI; a correct redo finishes with no points.
      return correct ? moved({ kind: "DONE", unaided: false }) : moved(state);
    default:
      return same(state);
  }
}

/** Pure answer-gate transition (SDD P2-12); every limit comes from the policy. */
export function transition(state: GateState, event: GateEvent, policy: AiPolicy): GateResult {
  if (event.type === "HINT") return hint(state, policy);
  if (event.type === "ANSWER") return answer(state, event.correct, policy);
  if (state.kind !== "PRACTICE_REQUIRED") return same(state);
  if (policy.practiceItems <= 0) return moved({ kind: "DONE", unaided: false }, "PRACTICE_SET_DONE");
  return moved({ kind: "PRACTICE_OPEN", done: 0, hints: 0 });
}

/** True while nothing after this question may unlock; the academics service reads this. */
export function locked(state: GateState): boolean {
  return state.kind === "LOCKED_REDO" || state.kind === "PRACTICE_OPEN" || state.kind === "PRACTICE_REQUIRED";
}

/** Whether the AI may still help in this state. */
export function aiAvailable(state: GateState): boolean {
  return state.kind === "OPEN" || state.kind === "ASSISTED" || state.kind === "PRACTICE_OPEN";
}
