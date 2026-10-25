import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
afterEach(() => vi.unstubAllEnvs());
it("separates Vercel ingress client addresses while retaining rate limits", async () => {
  vi.stubEnv("VERCEL", "1");
  const app = createApp();
  for (let i = 0; i < 120; i++)
    expect(
      (await request(app).get("/health").set("x-forwarded-for", "203.0.113.1"))
        .status,
    ).toBe(200);
  expect(
    (await request(app).get("/health").set("x-forwarded-for", "203.0.113.1"))
      .status,
  ).toBe(429);
  expect(
    (await request(app).get("/health").set("x-forwarded-for", "203.0.113.2"))
      .status,
  ).toBe(200);
});
