import { describe, expect, it } from "vitest";
import { locked, transition, type GateEvent, type GateState } from "./gate";
import { DEFAULT_POLICY, type AiPolicy } from "./policy";

const policy = DEFAULT_POLICY;
const hint: GateEvent = { type: "HINT" };
const right: GateEvent = { type: "ANSWER", correct: true };
const wrong: GateEvent = { type: "ANSWER", correct: false };
const start: GateEvent = { type: "START_PRACTICE" };

const OPEN: GateState = { kind: "OPEN" };
const ASSISTED = (hints: number): GateState => ({ kind: "ASSISTED", hints });
const REQUIRED: GateState = { kind: "PRACTICE_REQUIRED" };
const PRACTICE = (done: number, hints = 0): GateState => ({ kind: "PRACTICE_OPEN", done, hints });
const DONE_UNAIDED: GateState = { kind: "DONE", unaided: true };
const DONE_HELPED: GateState = { kind: "DONE", unaided: false };
const LOCKED: GateState = { kind: "LOCKED_REDO" };

type Row = [string, GateState, GateEvent, GateState, boolean, string | null];

const table: Row[] = [
  ["open + correct", OPEN, right, DONE_UNAIDED, true, "UNAIDED_CORRECT"],
  ["open + wrong stays", OPEN, wrong, OPEN, true, null],
  ["open + first hint", OPEN, hint, ASSISTED(1), true, null],
  ["open + start practice rejected", OPEN, start, OPEN, false, null],
  ["assisted 1 + hint", ASSISTED(1), hint, ASSISTED(2), true, null],
  ["assisted 2 + hint", ASSISTED(2), hint, ASSISTED(3), true, null],
  ["assisted 3 + 4th hint locks", ASSISTED(3), hint, LOCKED, true, null],
  ["assisted + correct needs practice", ASSISTED(2), right, REQUIRED, true, null],
  ["assisted + wrong stays", ASSISTED(2), wrong, ASSISTED(2), true, null],
  ["required + start opens practice", REQUIRED, start, PRACTICE(0), true, null],
  ["required + hint rejected", REQUIRED, hint, REQUIRED, false, null],
  ["required + answer rejected", REQUIRED, right, REQUIRED, false, null],
  ["practice + wrong stays", PRACTICE(2, 1), wrong, PRACTICE(2, 1), true, null],
  ["practice + correct moves on and resets hints", PRACTICE(2, 2), right, PRACTICE(3, 0), true, null],
  ["practice + hint counts", PRACTICE(1, 0), hint, PRACTICE(1, 1), true, null],
  ["practice + 4th hint on an item locks", PRACTICE(1, 3), hint, LOCKED, true, null],
  ["practice + fifth correct is done", PRACTICE(4), right, DONE_HELPED, true, "PRACTICE_SET_DONE"],
  ["practice + start rejected", PRACTICE(1), start, PRACTICE(1), false, null],
  ["done + anything rejected (hint)", DONE_UNAIDED, hint, DONE_UNAIDED, false, null],
  ["done + anything rejected (answer)", DONE_HELPED, right, DONE_HELPED, false, null],
  ["locked + hint rejected (no AI)", LOCKED, hint, LOCKED, false, null],
  ["locked + wrong stays", LOCKED, wrong, LOCKED, true, null],
  ["locked + correct redo finishes with no points", LOCKED, right, DONE_HELPED, true, null],
  ["locked + start rejected", LOCKED, start, LOCKED, false, null],
];

describe("gate transition table", () => {
  it.each(table)("%s", (_name, from, event, to, accepted, award) => {
    const result = transition(from, event, policy);
    expect(result.state).toEqual(to);
    expect(result.accepted).toBe(accepted);
    expect(result.award).toBe(award);
  });
});

describe("gate rules", () => {
  it("walks the full helped path: three hints, correct, practice, done", () => {
    let s: GateState = OPEN;
    for (const e of [hint, hint, hint, right, start]) s = transition(s, e, policy).state;
    expect(s).toEqual(PRACTICE(0));
    for (let i = 0; i < policy.practiceItems - 1; i++) s = transition(s, right, policy).state;
    const last = transition(s, right, policy);
    expect(last.state).toEqual(DONE_HELPED);
    expect(last.award).toBe("PRACTICE_SET_DONE");
  });

  it("a fourth hint always locks, whatever the answers in between", () => {
    let s: GateState = OPEN;
    for (const e of [hint, wrong, hint, wrong, hint, wrong]) s = transition(s, e, policy).state;
    expect(transition(s, hint, policy).state).toEqual(LOCKED);
  });

  it("locked() is true for practice and locked redo, false for open, assisted and done", () => {
    expect(locked(LOCKED)).toBe(true);
    expect(locked(PRACTICE(0))).toBe(true);
    expect(locked(REQUIRED)).toBe(true);
    for (const s of [OPEN, ASSISTED(2), DONE_UNAIDED, DONE_HELPED]) expect(locked(s)).toBe(false);
  });
});

describe("policy values change behaviour", () => {
  const custom = (over: Partial<AiPolicy>): AiPolicy => ({ ...policy, ...over });

  it("hintsPerQuestion = 1 locks on the second hint", () => {
    const p = custom({ hintsPerQuestion: 1 });
    const one = transition(OPEN, hint, p).state;
    expect(one).toEqual(ASSISTED(1));
    expect(transition(one, hint, p).state).toEqual(LOCKED);
  });

  it("hintsPerQuestion = 0 locks on the first hint", () => {
    expect(transition(OPEN, hint, custom({ hintsPerQuestion: 0 })).state).toEqual(LOCKED);
  });

  it("hintsPerQuestion = 5 allows five hints", () => {
    const p = custom({ hintsPerQuestion: 5 });
    expect(transition(ASSISTED(4), hint, p).state).toEqual(ASSISTED(5));
    expect(transition(ASSISTED(5), hint, p).state).toEqual(LOCKED);
  });

  it("practiceItems = 2 finishes on the second correct item", () => {
    const p = custom({ practiceItems: 2 });
    expect(transition(PRACTICE(0), right, p).state).toEqual(PRACTICE(1));
    expect(transition(PRACTICE(1), right, p).award).toBe("PRACTICE_SET_DONE");
  });

  it("practiceItems = 0 finishes as soon as practice starts", () => {
    const r = transition(REQUIRED, start, custom({ practiceItems: 0 }));
    expect(r.state).toEqual(DONE_HELPED);
    expect(r.award).toBe("PRACTICE_SET_DONE");
  });
});
