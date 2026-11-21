import { afterEach, test, expect, vi } from "vitest";
import { gmailConfig } from "../src/services/gmail";
afterEach(() => vi.unstubAllEnvs());
const keys = [
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REDIRECT_URI",
  "GMAIL_ENCRYPTION_KEY",
] as const;
function configure() {
  vi.stubEnv("GMAIL_CLIENT_ID", "synthetic-client");
  vi.stubEnv("GMAIL_CLIENT_SECRET", "synthetic-secret");
  vi.stubEnv(
    "GMAIL_REDIRECT_URI",
    "https://frontend.example.test/email-updates",
  );
  vi.stubEnv("GMAIL_ENCRYPTION_KEY", "ab".repeat(32));
}
test("Gmail config requires all four server-only settings and a valid encryption key", () => {
  for (const key of keys) {
    configure();
    vi.stubEnv(key, "");
    expect(() => gmailConfig()).toThrow(
      "Gmail is not configured on this server.",
    );
  }
  configure();
  vi.stubEnv("GMAIL_ENCRYPTION_KEY", "bad");
  expect(() => gmailConfig()).toThrow(
    "Gmail is not configured on this server.",
  );
  configure();
  expect(gmailConfig().redirect_uri).toBe(
    "https://frontend.example.test/email-updates",
  );
});
