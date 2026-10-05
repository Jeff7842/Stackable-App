import { buildDb, TABLES, type Db, type Store } from "./tables";
import { DEFAULT_FIND_LIMIT, type FindOptions, type NewRow, type Repo, type Row, type TableDef, type Where } from "./types";

type Tables = Map<string, Map<string, Row & Record<string, unknown>>>;

export interface MemoryStoreOptions {
  /** Test hook: throw from here to simulate a failing write inside a transaction. */
  onInsert?: (table: string) => void;
}

function matches(row: Record<string, unknown>, where: Where<Record<string, unknown>>): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want === undefined) return true;
    const have = row[key] ?? null;
    return Array.isArray(want) ? want.includes(have) : have === want;
  });
}

function repoFor<T extends Row>(def: TableDef<T>, rows: Map<string, Row & Record<string, unknown>>, schoolId: string, opts: MemoryStoreOptions): Repo<T> {
  const stamps = def.keys.includes("createdAt" as never);
  const updates = def.keys.includes("updatedAt" as never);
  // Reads mirror row-level security: another school's rows are simply not visible.
  const own = () => [...rows.values()].filter((r) => r.schoolId === schoolId);
  const out = (r: Row) => structuredClone(r) as unknown as T;

  return {
    async insert(row: NewRow<T>) {
      opts.onInsert?.(def.name);
      const now = new Date().toISOString();
      const full = {
        ...structuredClone(row),
        id: (row as { id?: string }).id ?? crypto.randomUUID(),
        schoolId,
        ...(stamps ? { createdAt: now } : {}),
        ...(updates ? { updatedAt: now } : {}),
      } as unknown as Row & Record<string, unknown>;
      rows.set(full.id, full);
      return out(full);
    },
    async get(id) {
      const r = rows.get(id);
      return r && r.schoolId === schoolId ? out(r) : undefined;
    },
    async getMany(ids) {
      return own().filter((r) => ids.includes(r.id)).map(out);
    },
    async find(where = {}, o: FindOptions<T> = {}) {
      let list = own().filter((r) => matches(r, where as Where<Record<string, unknown>>));
      for (const [key, bound] of Object.entries(o.lt ?? {})) {
        list = list.filter((r) => r[key] != null && (r[key] as string | number) < (bound as string | number));
      }
      const order = o.orderBy ?? ("createdAt" in (list[0] ?? {}) ? "createdAt" : "id");
      const key = (r: Row & Record<string, unknown>) => r[order] as string | number;
      list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : a.id.localeCompare(b.id)));
      return list.slice(0, o.limit ?? DEFAULT_FIND_LIMIT).map(out);
    },
    async update(id, patch) {
      const r = rows.get(id);
      if (!r || r.schoolId !== schoolId) return undefined;
      Object.assign(r, structuredClone(patch), updates ? { updatedAt: new Date().toISOString() } : {});
      return out(r);
    },
    async updateMany(where, patch) {
      const hit = own().filter((r) => matches(r, where as Where<Record<string, unknown>>));
      for (const r of hit) Object.assign(r, structuredClone(patch), updates ? { updatedAt: new Date().toISOString() } : {});
      return hit.length;
    },
  };
}

/** In-memory store with the same contract as the pg store; transactions are serialised and roll back on throw. */
export function createMemoryStore(opts: MemoryStoreOptions = {}): Store {
  const data: Tables = new Map(Object.values(TABLES).map((d) => [d.name, new Map()]));
  let queue: Promise<unknown> = Promise.resolve();

  const snapshot = () => new Map([...data].map(([name, rows]) => [name, structuredClone(rows)]));

  async function run<T>(schoolId: string, fn: (db: Db) => Promise<T>): Promise<T> {
    const before = snapshot();
    const db = buildDb((def) => repoFor(def, data.get(def.name)!, schoolId, opts));
    try {
      return await fn(db);
    } catch (err) {
      for (const [name, rows] of before) data.set(name, rows);
      throw err;
    }
  }

  return {
    tx(schoolId, fn) {
      const result = queue.then(() => run(schoolId, fn));
      queue = result.catch(() => undefined);
      return result;
    },
    async dueSchoolIds(now) {
      const due = [...data.get("attempts")!.values()].filter(
        (a) => a.status === "IN_PROGRESS" && typeof a.dueAt === "string" && a.dueAt < now.toISOString(),
      );
      return [...new Set(due.map((a) => a.schoolId))];
    },
  };
}
