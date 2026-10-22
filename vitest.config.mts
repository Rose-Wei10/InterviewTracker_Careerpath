import { defineConfig } from "vitest/config";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["server/tests/*.test.ts", "client/tests/*.test.tsx"],
    exclude: ["server/tests/*.integration.test.ts"],
    environment: "node",
    env: { NODE_ENV: "test" },
    testTimeout: 15000,
  },
});
