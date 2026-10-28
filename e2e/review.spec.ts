import { test, expect } from "@playwright/test";
import { pdfFixture } from "../server/tests/pdf-fixture";
const headers = { Authorization: "Bearer browser-test-token" };
const jd =
  "We need React, Node.js and AWS for accessible customer-facing applications. At least 3 years of professional experience is required.";
const text =
  "- Helped with React interfaces and NodeJS APIs\n- Built Figma prototypes and automated tests\n- Helped with documentation";
test("free pasted-text review links to a job, saves snapshots and warns about changed inputs", async ({
  page,
}) => {
  const created = await page.request.post(
    "http://127.0.0.1:5019/api/applications",
    {
      headers,
      data: {
        company: "Resume Review Journey",
        role: "Engineer",
        appliedDate: "2026-10-27",
        jobDescription: jd,
      },
    },
  );
  expect(created.status()).toBe(201);
  const job = await created.json();
  await page.goto(`/applications/${job.id}`);
  await page
    .getByRole("link", { name: "Review for a job", exact: true })
    .click();
  await expect(page.getByLabel("Job description", { exact: true })).toHaveValue(
    jd,
  );
  await page.getByLabel("Resume text", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Find requirements", exact: true })
    .click();
  await expect(page.getByLabel("Requirement 1", { exact: true })).toHaveValue(
    "React",
  );
  await page.getByLabel("Custom requirement", { exact: true }).fill("Figma");
  await page
    .getByRole("button", { name: "Add requirement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  const report = page.getByRole("region", { name: "Resume review report" });
  await expect(report).toBeVisible();
  await expect(
    report.getByText("3 of 4 reviewed keywords found", { exact: true }),
  ).toBeVisible();
  await expect(
    report.getByText("Review manually", { exact: true }),
  ).toBeVisible();
  await expect(
    report.getByText(/Clarify your own action/).first(),
  ).toBeVisible();
  await page
    .getByLabel("Job description", { exact: true })
    .fill(jd + " Python is preferred.");
  await expect(
    report.getByText(/This report belongs to previous inputs/),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Save job description to application",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Job description saved to application", { exact: true }),
  ).toBeVisible();
  await report
    .getByText("Job description used for this report", { exact: true })
    .click();
  await expect(report.getByText(jd, { exact: true })).toBeVisible();
  await page.goto(`/applications/${job.id}`);
  const saved = page.getByRole("link", { name: /Pasted resume.*completed/ });
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(
    report.getByText("3 of 4 reviewed keywords found", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/preview/free-review-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("uploaded PDF can be previewed and reviewed through private sandbox storage", async ({
  page,
}) => {
  await page.goto("/resumes");
  await page
    .getByRole("button", { name: "Upload resume", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Name", { exact: true }).fill("REVIEW TEST PDF");
  await form.getByLabel("PDF file (maximum 4 MB)").setInputFiles({
    name: "review-test.pdf",
    mimeType: "application/pdf",
    buffer: await pdfFixture(
      "Built React applications with TypeScript and PostgreSQL.",
    ),
  });
  await form.getByRole("button", { name: "Upload PDF", exact: true }).click();
  await expect(form).not.toBeVisible();
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "REVIEW TEST PDF", exact: true }),
  });
  await card
    .getByRole("link", { name: "Review for a job", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview extracted text", exact: true })
    .click();
  await expect(
    page.getByLabel("Extracted resume text", { exact: true }),
  ).toHaveValue(/Built React/);
  await page.getByLabel("Job description", { exact: true }).fill(jd);
  await page
    .getByRole("button", { name: "Find requirements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  const report = page.getByRole("region", { name: "Resume review report" });
  await expect(
    report.getByRole("heading", { name: "REVIEW TEST PDF", exact: true }),
  ).toBeVisible();
  await expect(
    report.getByText("1 of 3 reviewed keywords found", { exact: true }),
  ).toBeVisible();
  const resumes = await page.request.get("http://127.0.0.1:5019/api/resumes", {
    headers,
  });
  const pdf = (await resumes.json()).find(
    (r: { name: string }) => r.name === "REVIEW TEST PDF",
  );
  await page.route(`**/api/resumes/${pdf.id}/text`, (route) =>
    route.fulfill({
      status: 503,
      json: {
        message:
          "Resume storage is unavailable. Paste your resume text instead.",
      },
    }),
  );
  await page
    .getByRole("button", { name: "Preview extracted text", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Resume storage is unavailable",
  );
  await page
    .getByRole("button", { name: "Paste resume text", exact: true })
    .click();
  await page.getByLabel("Resume text", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  await expect(
    report.getByRole("heading", { name: "Pasted resume", exact: true }),
  ).toBeVisible();
});
test("mobile review keeps inputs on failure, accepts custom requirements and handles no recognized keywords", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({
    "x-browser-test-user": "mobile-review-user",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analysis");
  await page.getByLabel("Resume text", { exact: true }).fill(text);
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "We need an editor to organize thoughtful articles and proofread long-form manuscripts.",
    );
  await page
    .getByRole("button", { name: "Find requirements", exact: true })
    .click();
  await expect(page.getByText(/No requirements selected/)).toBeVisible();
  await page.route("**/api/analyses", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 503,
          json: { message: "Temporary review failure; retry." },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Temporary review failure",
  );
  await expect(page.getByLabel("Resume text", { exact: true })).toHaveValue(
    text,
  );
  await page.unroute("**/api/analyses");
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  const report = page.getByRole("region", { name: "Resume review report" });
  await expect(
    report.getByText("No keyword assessment available", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Custom requirement", { exact: true })
    .fill("Proofreading");
  await page
    .getByRole("button", { name: "Add requirement", exact: true })
    .click();
  await expect(page.getByLabel("Requirement 1", { exact: true })).toHaveValue(
    "Proofreading",
  );
  await page
    .getByRole("button", { name: "Remove requirement 1", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/preview/free-review-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
