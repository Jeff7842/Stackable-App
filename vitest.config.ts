import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./stackable-app", import.meta.url)) },
  },
  test: {
    include: ["stackable-app/**/*.test.ts", "packages/**/*.test.ts", "services/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
