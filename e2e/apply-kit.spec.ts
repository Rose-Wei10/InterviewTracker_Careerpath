import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Apply Kit saves, searches, copies and removes reusable answers", async ({
  page,
  context,
}) => {
  const owner = `apply-kit-${randomUUID()}`;
  await page.setExtraHTTPHeaders({
    "x-browser-test-user": owner,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Apply Kit", exact: true }).click();
  await page.getByText("Starter questions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Answer: Legal first name", exact: true })
    .click();
  await page.getByLabel("Answer", { exact: true }).fill("Synthetic Applicant");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Synthetic Applicant", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Copy autofill data" }).click();
  await expect(page.getByRole("status")).toContainText("Autofill data copied");
  expect(
    JSON.parse(await page.evaluate(() => navigator.clipboard.readText())),
  ).toEqual({
    format: "careerpath-apply-kit",
    version: 1,
    careerpathOrigin: new URL(page.url()).origin,
    entries: [
      {
        starterKey: "first-name",
        prompt: "Legal first name",
        answer: "Synthetic Applicant",
        review: false,
      },
    ],
  });

  await page.getByRole("button", { name: "Add question", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Question").fill("How do you teach loops?");
  await dialog.getByLabel("Category").selectOption("Mentoring");
  await dialog
    .getByLabel("Answer")
    .fill("I ask learners to repeat a short dance pattern.");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByLabel("Search Apply Kit").fill("dance pattern");
  await expect(
    page.getByText("Synthetic Applicant", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Copy: How do you teach loops?" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Copied to clipboard.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "I ask learners to repeat a short dance pattern.",
  );

  const otherContext = await context.browser()!.newContext({
    baseURL: "http://127.0.0.1:5179",
    extraHTTPHeaders: { "x-browser-test-user": owner },
  });
  try {
    const secondDevice = await otherContext.newPage();
    await secondDevice.goto("/apply-kit");
    await expect(
      secondDevice.getByText("How do you teach loops?", { exact: true }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }

  await page.route("**/api/apply-kit/*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          json: { message: "This answer changed in another session." },
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Edit: How do you teach loops?" })
    .click();
  await dialog
    .getByLabel("Answer")
    .fill("Keep this draft after a failed save.");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "changed in another session",
  );
  await expect(dialog.getByLabel("Answer")).toHaveValue(
    "Keep this draft after a failed save.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit: How do you teach loops?" }),
  ).toBeFocused();

  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new Error("Clipboard denied");
      },
    });
  });
  await page
    .getByRole("button", { name: "Copy: How do you teach loops?" })
    .click();
  await expect(page.getByRole("status")).toContainText("copy it manually");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Apply Kit", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand navigation" }).click();

  await page.getByLabel("Search Apply Kit").fill("");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light"]) {
      if ((await page.locator(".app").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", {
            name: theme === "dark" ? "Dark mode" : "Light mode",
            exact: true,
          })
          .click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `test-results/preview/apply-kit-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page
    .getByRole("button", { name: "Delete: How do you teach loops?" })
    .click();
  await dialog.getByRole("button", { name: "Delete question" }).click();
  await expect(
    page.getByText("How do you teach loops?", { exact: true }),
  ).toHaveCount(0);
});

test("confirmed application handoff checks the original job link before offering a save", async ({
  page,
}) => {
  const owner = `apply-kit-${randomUUID()}`;
  await page.setExtraHTTPHeaders({ "x-browser-test-user": owner });
  const jobLink = "https://employer.example.test/jobs/123?source=listing";
  await page.goto(
    `/applications?${new URLSearchParams({ recordLink: jobLink })}`,
  );
  await page.getByRole("button", { name: "Add confirmed application" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Job URL")).toHaveValue(jobLink);
  await dialog.getByLabel("Company").fill("Synthetic Employer");
  await dialog.getByLabel("Role").fill("Software Engineer");
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).not.toBeVisible();

  await page.goto(
    `/applications?${new URLSearchParams({ recordLink: jobLink })}`,
  );
  const edit = page.getByRole("button", {
    name: "Edit Synthetic Employer · Software Engineer",
  });
  await expect(edit).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add confirmed application" }),
  ).toHaveCount(0);
  await edit.click();
  await expect(dialog.getByLabel("Job URL")).toHaveValue(jobLink);
});
