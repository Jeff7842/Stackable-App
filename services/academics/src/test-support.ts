import { createHmac } from "node:crypto";
import { vi } from "vitest";
import { buildApp } from "./app";
import { createMemoryStore, type MemoryStoreOptions } from "./store/memory";

export const SCHOOL_A = "11111111-1111-4111-8111-111111111111";
export const SCHOOL_B = "22222222-2222-4222-8222-222222222222";
export const TEACHER = "teacher-1";
export const STUDENT = "student-1";
export const STUDENT_2 = "student-2";
export const PARENT = "parent-1";
export const CLASS_ID = "class-7a";
export const SUBJECT_ID = "subject-math";
const SECRET = "test-secret-test-secret-test-secret-1234";

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Signs an HS256 service token with node:crypto so tests can set the `rel` claim the shared signer lacks. */
export function token(sub: string, role: string, schoolId = SCHOOL_A, extra: Record<string, unknown> = {}): string {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ iss: "stackable-gateway", aud: "academics", sub, role, schoolId, iat: now, exp: now + 300, ...extra });
  const signature = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export const teacherToken = (schoolId = SCHOOL_A) => token(TEACHER, "teacher", schoolId);
export const adminToken = (schoolId = SCHOOL_A) => token("admin-1", "admin", schoolId);
export const releaserToken = (schoolId = SCHOOL_A) => token(TEACHER, "teacher", schoolId, { rel: true });
export const studentToken = (id = STUDENT, schoolId = SCHOOL_A) => token(id, "student", schoolId);
export const parentToken = (id = PARENT, schoolId = SCHOOL_A) => token(id, "parent", schoolId);

export function useTestEnv(): void {
  process.env.SERVICE_TOKEN_SECRET = SECRET;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
}

export interface Harness {
  store: ReturnType<typeof createMemoryStore>;
  setNow(iso: string): void;
  call(method: string, path: string, bearer: string | undefined, body?: unknown): Promise<{ status: number; body: any }>;
}

/** An app on the in-memory store with a movable server clock. */
export function harness(startIso = "2026-03-01T08:00:00.000Z", opts: MemoryStoreOptions = {}): Harness {
  let current = new Date(startIso);
  const store = createMemoryStore(opts);
  const app = buildApp(store, undefined, "test", () => current);
  return {
    store,
    setNow: (iso) => {
      current = new Date(iso);
    },
    async call(method, path, bearer, body) {
      const res = await app.request(path, {
        method,
        headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => undefined) };
    },
  };
}

/** Creates and activates a whole-number grading system (A 80-100 ... E 0-39, pass 40). */
export async function seedGrading(h: Harness, schoolId = SCHOOL_A): Promise<void> {
  const created = await h.call("POST", "/v1/grading/systems", adminToken(schoolId), {
    name: "Default",
    effectiveFrom: "2026-01-01T00:00:00Z",
    bands: [
      { minPct: 80, maxPct: 100, grade: "A", points: 12, remark: "Excellent" },
      { minPct: 60, maxPct: 79, grade: "B", points: 9 },
      { minPct: 40, maxPct: 59, grade: "C", points: 6 },
      { minPct: 0, maxPct: 39, grade: "E", points: 1 },
    ],
    passMarks: [{ passPct: 40 }],
  });
  await h.call("POST", `/v1/grading/systems/${created.body.id}/activate`, adminToken(schoolId));
}
