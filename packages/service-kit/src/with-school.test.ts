import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { withSchool } from "./with-school";

function fakePool() {
  const query = vi.fn(async () => ({ rows: [] }));
  const release = vi.fn();
  const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
  return { pool, query, release };
}

describe("withSchool", () => {
  it("sets app.school_id inside a transaction and commits", async () => {
    const { pool, query, release } = fakePool();
    const result = await withSchool(pool, "school-1", async () => "done");
    expect(result).toBe("done");
    expect(query.mock.calls).toEqual([
      ["BEGIN"],
      ["select set_config('app.school_id', $1, true)", ["school-1"]],
      ["COMMIT"],
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back, rethrows and releases when fn fails", async () => {
    const { pool, query, release } = fakePool();
    await expect(withSchool(pool, "school-1", async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
