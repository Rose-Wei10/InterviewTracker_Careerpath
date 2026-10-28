// @vitest-environment jsdom
import { afterEach, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ReviewReport from "../src/components/match/ReviewReport";
import type { Analysis } from "../src/types";
afterEach(cleanup);
const base: Analysis = {
  id: "report",
  mode: "rules",
  createdAt: "2026-10-28T12:00:00Z",
  status: "completed",
  jobDescription: "Original job snapshot",
  resume: null,
  result: {
    schemaVersion: 2,
    checks: [
      {
        term: "React",
        kind: "keyword",
        found: true,
        quote: "Built React interfaces",
      },
    ],
    foundCount: 1,
    keywordCount: 1,
    improvements: [],
    preparationTopics: [],
    warnings: [],
  },
};
it("renders text-only reports and warns when the form no longer matches", () => {
  render(<ReviewReport report={base} stale />);
  expect(
    screen.getByRole("heading", { name: "Pasted resume", exact: true }),
  ).toBeVisible();
  expect(screen.getByText("1 of 1 reviewed keywords found")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("previous inputs");
  expect(screen.getByText("Built React interfaces")).toBeVisible();
});
it("keeps legacy results readable without requiring a linked resume", () => {
  render(
    <ReviewReport
      report={{
        ...base,
        mode: "demo",
        result: {
          supportedSkills: [],
          missingSkills: [],
          improvements: [],
          preparationTopics: [],
          heuristicScore: 0,
          assessmentLabel: "Legacy keyword evidence",
        },
      }}
    />,
  );
  expect(screen.getByText(/Historical report/)).toBeVisible();
  expect(screen.getByText("Legacy keyword evidence")).toBeVisible();
});
it("distinguishes processing from failed attempts", () => {
  const { rerender } = render(
    <ReviewReport report={{ ...base, status: "pending", result: null }} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Review is processing");
  rerender(
    <ReviewReport
      report={{
        ...base,
        status: "failed",
        failureReason: "Paste a text-based version instead.",
        result: null,
      }}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Paste a text-based version instead.",
  );
});
