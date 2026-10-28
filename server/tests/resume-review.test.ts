import { describe, it, expect } from "vitest";
import {
  detectRequirements,
  reviewResume,
  keywordPattern,
} from "../src/services/resumeReview";
import { analysisInput } from "../src/services/analysis";
describe("free evidence review", () => {
  it("handles aliases and punctuation without Java/JavaScript or C/C++ false matches", () => {
    const result = reviewResume(
      "Built ReactJS and NodeJS services with Postgres, C++, C#, and dotnet.",
      detectRequirements(
        "We need React, Node.js, PostgreSQL, Java, C++, C# and .NET.",
      ),
    );
    expect(result.checks.filter((r) => r.found).map((r) => r.term)).toEqual([
      "React",
      "Node.js",
      "C++",
      "C#",
      ".NET",
      "PostgreSQL",
    ]);
    expect(keywordPattern("Java").test("JavaScript")).toBe(false);
    expect(keywordPattern("C").test("C++ C#")).toBe(false);
    expect(keywordPattern("AWS").test("Flaws")).toBe(false);
    expect(keywordPattern("nodejs").test("Node.js")).toBe(true);
    expect(
      reviewResume("Built ReactJS interfaces", [
        { term: "React", kind: "keyword" },
        { term: "ReactJS", kind: "keyword" },
      ]).keywordCount,
    ).toBe(1);
  });
  it("quotes an actual matching excerpt, supports literal custom terms and leaves experience manual", () => {
    const text =
      "Experienced in 3 years of editorial work.\nBuilt an editorial workflow with Figma and accessibility checks.";
    const result = reviewResume(text, [
      { term: "Figma", kind: "keyword" },
      { term: "3 years of editorial work", kind: "manual" },
      { term: "a+b (test)", kind: "keyword" },
    ]);
    expect(result.checks[0].quote).toBe(
      "Built an editorial workflow with Figma and accessibility checks.",
    );
    expect(result.checks[1].found).toBe(false);
    expect(result.checks[2].found).toBe(false);
    for (const r of result.checks) if (r.quote) expect(text).toContain(r.quote);
  });
  it("does not mark a negated mention as positive evidence", () => {
    expect(
      reviewResume("No experience with AWS.", [
        { term: "AWS", kind: "keyword" },
      ]).foundCount,
    ).toBe(0);
  });
  it("makes prompts about existing bullets without inventing metrics or achievements", () => {
    const text =
      "- Helped with React interfaces\n- Helped with testing\n- Helped with documentation";
    const r = reviewResume(text, []);
    expect(r.improvements).toHaveLength(3);
    expect(r.improvements[0].suggestions.join(" ")).toMatch(
      /Clarify your own action/,
    );
    expect(r.improvements[0].suggestions.join(" ")).toMatch(/opening repeats/);
    expect(r.improvements[0].suggestions.join(" ")).toMatch(
      /only when you have evidence/,
    );
    expect(r.keywordCount).toBe(0);
    expect(r).not.toHaveProperty("heuristicScore");
  });
  it("bounds and validates sources without accepting mass assignment", () => {
    const base = {
      jobDescription:
        "We need React and TypeScript engineers to build accessible websites.",
    };
    for (const body of [
      { ...base },
      {
        ...base,
        resumeId: "pdf",
        resumeText: "Valid resume text over twenty characters",
      },
      { ...base, resumeText: "short" },
      { ...base, resumeText: "x".repeat(40001) },
      {
        ...base,
        resumeText: "valid resume text longer than twenty characters",
        userId: "bob",
      },
    ])
      expect(analysisInput.safeParse(body).success).toBe(false);
    expect(
      analysisInput.safeParse({
        ...base,
        resumeText: "Valid resume text longer than twenty characters",
        requirements: [],
      }).success,
    ).toBe(true);
  });
});
