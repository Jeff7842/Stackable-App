import type { Store } from "../../store/tables";
import { autoSubmitSchool } from "./attempts";

/**
 * Auto-submits every attempt whose server deadline passed, school by school so row-level security holds.
 * Run from one instance only; the clock is injected so tests can move time.
 */
export async function autoSubmitDue(store: Store, now: Date): Promise<number> {
  let closed = 0;
  for (const schoolId of await store.dueSchoolIds(now)) {
    closed += await store.tx(schoolId, (db) => autoSubmitSchool(db, now));
  }
  return closed;
}
