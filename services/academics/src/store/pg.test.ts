import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildInsert, buildSelect, buildUpdate } from "./pg";
import { TABLES } from "./tables";
import type { Row, TableDef } from "./types";

const school = "11111111-1111-4111-8111-111111111111";
const attempts = TABLES.attempts as unknown as TableDef<Row>;
const outbox = TABLES.outbox as unknown as TableDef<Row>;

describe("sql builders", () => {
  it("scopes every select by school and parameterises values", () => {
    const q = buildSelect(attempts, school, { status: "IN_PROGRESS", id: ["a", "b"] }, { lt: { dueAt: "2026-01-01" } });
    expect(q.text).toBe(
      "select * from academics.attempts where school_id = $1 and status = $2 and id = any($3) and due_at < $4 order by created_at, id limit $5",
    );
    expect(q.values).toEqual([school, "IN_PROGRESS", ["a", "b"], "2026-01-01", 500]);
  });

  it("turns null into IS NULL", () => {
    expect(buildSelect(attempts, school, { submittedAt: null }, {}).text).toContain("submitted_at is null");
  });

  it("refuses a column that is not in the table definition", () => {
    expect(() => buildSelect(attempts, school, { "id; drop table x": 1 }, {})).toThrow(/unknown column/);
    expect(() => buildInsert(attempts, { evil: 1 })).toThrow(/unknown column/);
  });

  it("serialises json columns and bumps updated_at", () => {
    expect(buildInsert(outbox, { topic: "t", payload: { a: 1 } }).values).toEqual(["t", '{"a":1}']);
    const update = buildUpdate(attempts, school, { id: "x" }, { status: "MARKED" });
    expect(update.text).toBe("update academics.attempts set status = $1, updated_at = now() where school_id = $2 and id = $3 returning *");
  });
});

describe("migrations match the table registry", () => {
  const dir = join(__dirname, "..", "..", "migrations");
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(dir, f), "utf8").split("-- +goose Down")[0]).join("\n");
  const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

  function columnsOf(table: string): string[] {
    const body = new RegExp(`create table academics\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql)?.[1] ?? "";
    return body.split("\n").map((l) => l.trim()).filter((l) => /^[a-z_]+ /.test(l) && !/^(unique|check|primary|foreign|constraint)\b/.test(l)).map((l) => l.split(" ")[0]);
  }

  it.each(Object.entries(TABLES))("%s", (_key, def) => {
    expect(columnsOf(def.name).sort()).toEqual(def.keys.map(snake).sort());
  });

  it("every tenant table has row-level security", () => {
    for (const def of Object.values(TABLES)) expect(sql).toContain(`'${def.name}'`);
    expect(sql).toContain("current_setting(''app.school_id'', true)::uuid");
  });
});
