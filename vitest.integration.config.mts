import { defineConfig } from "vitest/config";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["server/tests/*.integration.test.ts"],
    environment: "node",
    env: { NODE_ENV: "test" },
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
