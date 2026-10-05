import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY } from "./policy";
import { appendEntry, pointsFor, totalPoints, type LedgerEntry } from "./points";

const entry = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "e1",
  studentId: "s1",
  questionId: "q1",
  reason: "UNAIDED_CORRECT",
  points: 10,
  createdAt: new Date(0),
  ...over,
});

describe("points", () => {
  it("reads award values from the policy", () => {
    expect(pointsFor("UNAIDED_CORRECT", { ...DEFAULT_POLICY, unaidedPoints: 20 })).toBe(20);
    expect(pointsFor("PRACTICE_SET_DONE", { ...DEFAULT_POLICY, practiceSetPoints: 7 })).toBe(7);
  });

  it("appends without mutating the old list", () => {
    const first: readonly LedgerEntry[] = [];
    const { ledger, added } = appendEntry(first, entry());
    expect(added).toBe(true);
    expect(first).toHaveLength(0);
    expect(ledger).toHaveLength(1);
  });

  it("ignores a repeat of the same student, question and reason", () => {
    const one = appendEntry([], entry()).ledger;
    const again = appendEntry(one, entry({ id: "e2" }));
    expect(again.added).toBe(false);
    expect(again.ledger).toHaveLength(1);
  });

  it("allows the same question for a different reason", () => {
    const one = appendEntry([], entry()).ledger;
    expect(appendEntry(one, entry({ id: "e2", reason: "PRACTICE_SET_DONE", points: 5 })).added).toBe(true);
  });

  it("totals one student only", () => {
    const l = [entry(), entry({ id: "e2", questionId: "q2" }), entry({ id: "e3", studentId: "s2" })];
    expect(totalPoints(l, "s1")).toBe(20);
  });
});
