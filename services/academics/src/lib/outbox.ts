import type { Db } from "../store/tables";

/** Writes an event in the caller's transaction so the fact and the event commit or roll back together. */
export async function emit(db: Db, topic: string, payload: Record<string, unknown>): Promise<void> {
  await db.outbox.insert({ topic, payload, publishedAt: null });
}
