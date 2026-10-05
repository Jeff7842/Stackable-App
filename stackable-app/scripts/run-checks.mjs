// Runs every *.check.ts script with tsx and fails if any exits non-zero.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SKIP = new Set(["node_modules", ".next", ".git", "generated"]);

function find(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) find(path, out);
    else if (name.endsWith(".check.ts")) out.push(path);
  }
  return out;
}

// SKIP_DB_CHECKS=1 skips checks that read the real database (e.g. in CI).
const files = find(".").filter((f) => !(process.env.SKIP_DB_CHECKS && f.includes(".repo.check")));
console.log(`Running ${files.length} check scripts`);
let failed = 0;
for (const file of files) {
  const r = spawnSync("pnpm", ["exec", "tsx", file], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    failed++;
    console.error(`FAILED: ${file}`);
  }
}
process.exit(failed ? 1 : 0);
