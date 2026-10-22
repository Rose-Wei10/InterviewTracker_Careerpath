import { describe, it, expect } from "vitest";
import {
  applicationSchema,
  updateSchema,
  listSchema,
  interviewSchema,
} from "../src/lib/validation";
import { validateEnv } from "../src/config/env";
import { demoAnalysis, validateEvidence } from "../src/services/analysis";
import { csvCell } from "../src/routes/applicationRoutes";
import { retryDelay } from "../src/jobs/reminders";
describe("request boundaries", () => {
  const valid = {
    company: "Acme",
    role: "Engineer",
    appliedDate: "2026-10-01",
  };
  it("trims required fields and rejects empty names", () => {
    expect(
      applicationSchema.parse({ ...valid, company: " Acme " }).company,
    ).toBe("Acme");
    expect(applicationSchema.safeParse({ ...valid, role: "  " }).success).toBe(
      false,
    );
  });
  it("rejects mass assignment, invalid status, unsafe URLs and invalid dates", () => {
    for (const extra of [
      { userId: "another-user" },
      { id: "changed" },
      { status: "Unknown" },
      { jobLink: "javascript:alert(1)" },
      { appliedDate: "bad" },
    ])
      expect(applicationSchema.safeParse({ ...valid, ...extra }).success).toBe(
        false,
      );
    expect(updateSchema.safeParse({ userId: "another-user" }).success).toBe(
      false,
    );
    expect(updateSchema.safeParse({}).success).toBe(false);
  });
  it("bounds pagination and date ranges", () => {
    expect(listSchema.parse({}).pageSize).toBe(20);
    for (const q of [
      { page: 0 },
      { pageSize: 101 },
      { sort: "userId" },
      { from: "2026-10-10", to: "2026-10-01" },
    ])
      expect(listSchema.safeParse(q).success).toBe(false);
  });
  it("validates zones and reminder offsets", () => {
    const i = {
      title: "Round 1",
      startsAt: "2026-11-01T17:00:00Z",
      timeZone: "America/Los_Angeles",
      type: "technical",
      reminderMinutes: 60,
    };
    expect(interviewSchema.safeParse(i).success).toBe(true);
    expect(interviewSchema.safeParse({ ...i, timeZone: "bad" }).success).toBe(
      false,
    );
  });
  it("does not include secret values in configuration errors", () => {
    expect(() => validateEnv({ CLERK_SECRET_KEY: "private-value" })).toThrow(
      /DATABASE_URL/,
    );
    try {
      validateEnv({ CLERK_SECRET_KEY: "private-value" });
    } catch (e) {
      expect(String(e)).not.toContain("private-value");
    }
  });
  it("escapes CSV formula injection and quotes", () => {
    expect(csvCell("=SUM(1,2)")).toBe('"\'=SUM(1,2)"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
describe("resume evidence", () => {
  it("matches whole keywords without inventing skills", () => {
    const r = demoAnalysis(
      "Built React interfaces with TypeScript and JavaScript.",
      "Looking for React, Java and PostgreSQL engineers.",
    );
    expect(r.supportedSkills.map((s) => s.skill)).toEqual(["React"]);
    expect(r.missingSkills).toEqual(["Java", "PostgreSQL"]);
    expect(r.improvements).toEqual([]);
    expect(r.heuristicScore).toBe(33);
  });
  it("rejects fabricated quotations and original bullets", () => {
    expect(() =>
      validateEvidence(
        {
          supportedSkills: [
            { skill: "Python", quote: "I built Python services" },
          ],
          missingSkills: [],
          improvements: [],
          preparationTopics: [],
        },
        "Built React apps",
        "Python",
      ),
    ).toThrow();
  });
  it("makes no match assessment when there are no recognized keywords", () => {
    expect(
      demoAnalysis("Experienced writer", "We need an editor").assessmentLabel,
    ).toContain("No recognized");
  });
  it("backs off and caps retry delay", () => {
    expect(retryDelay(1)).toBe(60000);
    expect(retryDelay(3)).toBe(240000);
    expect(retryDelay(100)).toBe(3600000);
  });
});
