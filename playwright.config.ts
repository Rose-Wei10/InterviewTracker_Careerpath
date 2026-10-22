import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5179", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "NODE_ENV=test ./node_modules/.bin/tsx server/tests/e2e-server.ts",
      url: "http://127.0.0.1:5019/health",
      reuseExistingServer: false,
    },
    {
      command:
        "VITE_API_URL=http://127.0.0.1:5019/api VITE_CLERK_PUBLISHABLE_KEY=e2e-placeholder npm run dev -w client -- --mode e2e --host 127.0.0.1 --port 5179",
      url: "http://127.0.0.1:5179",
      reuseExistingServer: false,
    },
  ],
});
