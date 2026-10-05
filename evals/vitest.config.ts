import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["evals/suite.test.ts", "tests/unit/prompt-eval*.test.ts"], testTimeout: 180_000, hookTimeout: 180_000, maxWorkers: 1, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "..") } },
});
