import type { GateAward } from "./gate";
import type { AiPolicy } from "./policy";

export interface LedgerEntry {
  id: string;
  studentId: string;
  questionId: string;
  reason: GateAward;
  points: number;
  createdAt: Date;
}

/** Points for an award, taken from the school policy. */
export function pointsFor(award: GateAward, policy: AiPolicy): number {
  return award === "UNAIDED_CORRECT" ? policy.unaidedPoints : policy.practiceSetPoints;
}

/** Appends an entry; a repeat of the same student, question and reason changes nothing. */
export function appendEntry(
  ledger: readonly LedgerEntry[],
  entry: LedgerEntry,
): { ledger: readonly LedgerEntry[]; added: boolean } {
  const exists = ledger.some(
    (e) => e.studentId === entry.studentId && e.questionId === entry.questionId && e.reason === entry.reason,
  );
  return exists ? { ledger, added: false } : { ledger: [...ledger, entry], added: true };
}

export function totalPoints(ledger: readonly LedgerEntry[], studentId: string): number {
  return ledger.filter((e) => e.studentId === studentId).reduce((sum, e) => sum + e.points, 0);
}
