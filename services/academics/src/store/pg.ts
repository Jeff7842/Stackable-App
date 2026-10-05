import type { Pool, PoolClient } from "pg";
import { AppError, withSchool } from "@stackable/service-kit";
import { buildDb, type Store } from "./tables";
import { DEFAULT_FIND_LIMIT, type FindOptions, type NewRow, type Repo, type Row, type TableDef, type Where } from "./types";

const UNIQUE_VIOLATION = "23505";
const SCHEMA = "academics";

const toSnake = (key: string) => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (col: string) => col.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());

interface Query {
  text: string;
  values: unknown[];
}

// Column names only ever come from the table definition, never from request data.
function column(def: TableDef<Row>, key: string): string {
  if (!def.keys.includes(key as never)) throw new Error(`unknown column ${key} on ${def.name}`);
  return toSnake(key);
}

function encode(def: TableDef<Row>, key: string, value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return def.json.includes(key as never) ? JSON.stringify(value) : value;
}

function buildWhere(def: TableDef<Row>, schoolId: string, where: Where<Record<string, unknown>>, values: unknown[]): string {
  values.push(schoolId);
  const parts = [`school_id = $${values.length}`]; // also enforced by RLS; this is the second lock
  for (const [key, want] of Object.entries(where)) {
    if (want === undefined) continue;
    const col = column(def, key);
    if (want === null) parts.push(`${col} is null`);
    else if (Array.isArray(want)) {
      values.push(want);
      parts.push(`${col} = any($${values.length})`);
    } else {
      values.push(encode(def, key, want));
      parts.push(`${col} = $${values.length}`);
    }
  }
  return parts.join(" and ");
}

export function buildInsert(def: TableDef<Row>, row: Record<string, unknown>): Query {
  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  const cols = keys.map((k) => column(def, k));
  return {
    text: `insert into ${SCHEMA}.${def.name} (${cols.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    values: keys.map((k) => encode(def, k, row[k])),
  };
}

export function buildSelect(def: TableDef<Row>, schoolId: string, where: Where<Record<string, unknown>>, opts: FindOptions<Record<string, unknown>>): Query {
  const values: unknown[] = [];
  const parts = [buildWhere(def, schoolId, where, values)];
  for (const [key, bound] of Object.entries(opts.lt ?? {})) {
    values.push(bound);
    parts.push(`${column(def, key)} < $${values.length}`);
  }
  const order = column(def, opts.orderBy ?? (def.keys.includes("createdAt" as never) ? "createdAt" : "id"));
  values.push(opts.limit ?? DEFAULT_FIND_LIMIT);
  return {
    text: `select * from ${SCHEMA}.${def.name} where ${parts.join(" and ")} order by ${order}, id limit $${values.length}`,
    values,
  };
}

export function buildUpdate(def: TableDef<Row>, schoolId: string, where: Where<Record<string, unknown>>, patch: Record<string, unknown>): Query {
  const values: unknown[] = [];
  const sets = Object.keys(patch)
    .filter((k) => patch[k] !== undefined)
    .map((k) => {
      values.push(encode(def, k, patch[k]));
      return `${column(def, k)} = $${values.length}`;
    });
  if (def.keys.includes("updatedAt" as never)) sets.push("updated_at = now()");
  return {
    text: `update ${SCHEMA}.${def.name} set ${sets.join(", ")} where ${buildWhere(def, schoolId, where, values)} returning *`,
    values,
  };
}

function fromDb<T>(raw: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [col, value] of Object.entries(raw)) out[toCamel(col)] = value instanceof Date ? value.toISOString() : value;
  return out as T;
}

function repoFor<T extends Row>(def: TableDef<T>, client: PoolClient, schoolId: string): Repo<T> {
  const d = def as unknown as TableDef<Row>;
  const run = async (q: Query) => (await client.query(q.text, q.values)).rows.map((r) => fromDb<T>(r));
  const w = (x: unknown) => x as Where<Record<string, unknown>>;

  return {
    async insert(row: NewRow<T>) {
      try {
        const [created] = await run(buildInsert(d, { ...row, id: (row as { id?: string }).id ?? crypto.randomUUID(), schoolId }));
        return created;
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new AppError(409, "RESOURCE_ALREADY_EXISTS", "Resource already exists");
        throw err;
      }
    },
    async get(id) {
      return (await run(buildSelect(d, schoolId, { id }, { limit: 1 })))[0] as T | undefined;
    },
    async getMany(ids) {
      return ids.length === 0 ? [] : ((await run(buildSelect(d, schoolId, { id: ids }, {}))) as T[]);
    },
    async find(where = {}, opts: FindOptions<T> = {}) {
      return (await run(buildSelect(d, schoolId, w(where), opts as FindOptions<Record<string, unknown>>))) as T[];
    },
    async update(id, patch) {
      return ((await run(buildUpdate(d, schoolId, { id }, patch)))[0] ?? undefined) as T | undefined;
    },
    async updateMany(where, patch) {
      return (await run(buildUpdate(d, schoolId, w(where), patch))).length;
    },
  };
}

/** Postgres store: each tx is one withSchool transaction, so RLS sees app.school_id on every query. */
export function createPgStore(pool: Pool): Store {
  return {
    tx: (schoolId, fn) => withSchool(pool, schoolId, (client) => fn(buildDb((def) => repoFor(def, client, schoolId)))),
    async dueSchoolIds(now) {
      // A security-definer function is the only way past RLS, and it returns ids only.
      const { rows } = await pool.query(`select school_id from ${SCHEMA}.due_attempt_school_ids($1)`, [now.toISOString()]);
      return rows.map((r: { school_id: string }) => r.school_id);
    },
  };
}
