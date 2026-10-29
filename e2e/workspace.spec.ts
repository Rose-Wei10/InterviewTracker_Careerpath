import { test, expect, type Page } from "@playwright/test";

async function centeredDialog(page: Page, compact = false) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () =>
      dialog.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          Math.abs(r.x + r.width / 2 - innerWidth / 2) < 2 &&
          Math.abs(r.y + r.height / 2 - innerHeight / 2) < 2 &&
          r.top >= 10 &&
          r.bottom <= innerHeight - 10 &&
          r.left >= 15 &&
          r.right <= innerWidth - 15
        );
      }),
    )
    .toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(compact ? 440 : 820);
  if (page.viewportSize()!.width === 1440)
    expect(box.width).toBe(compact ? 440 : 820);
  // Exercise native focus movement without leaving the browser's document.
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/preview/dialog-${page.viewportSize()!.width}-${await dialog.getAttribute("aria-label")}.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
}

test("workspace rails persist, reclaim width and stay usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/analysis");
  const form = page.locator(".review-workspace > section").first();
  const before = (await form.boundingBox())!.width;
  await page
    .getByRole("button", { name: "Collapse review history", exact: true })
    .click();
  await expect(page.locator("#review-history-content")).toBeHidden();
  await expect
    .poll(async () => (await form.boundingBox())!.width)
    .toBeGreaterThan(before + 150);
  const beforeNavigation = (await form.boundingBox())!.width;
  await page
    .getByRole("button", { name: "Collapse navigation", exact: true })
    .click();
  await expect
    .poll(async () => (await page.locator(".sidebar").boundingBox())!.width)
    .toBe(72);
  expect((await form.boundingBox())!.width).toBeGreaterThan(
    beforeNavigation + 100,
  );
  const match = page.getByRole("link", { name: "Match", exact: true });
  await match.focus();
  expect(
    await match.evaluate((el) => getComputedStyle(el, "::after").display),
  ).toBe("block");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expand navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Expand review history", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Expand review history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand navigation", exact: true })
    .click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator(".app").getAttribute("data-theme")) !== theme)
        await page
          .getByRole("button", {
            name: theme === "dark" ? "Dark mode" : "Light mode",
            exact: true,
          })
          .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/preview/glass-match-${width}-${theme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Collapse review history", exact: true })
    .click();
  await expect(page.getByText("Show history", { exact: true })).toBeVisible();
  expect(
    (await page.locator(".review-history").boundingBox())!.width,
  ).toBeGreaterThan(300);
});

test("all shared dialog types center after scrolling and respect reduced motion", async ({
  page,
}) => {
  const headers = {
    Authorization: "Bearer browser-test-token",
    "x-browser-test-user": "glass-dialog-user",
  };
  await page.setExtraHTTPHeaders({
    "x-browser-test-user": "glass-dialog-user",
  });
  const created = await page.request.post(
    "http://127.0.0.1:5019/api/applications",
    {
      headers,
      data: {
        company: "Glass Dialog Test",
        role: "Engineer",
        appliedDate: "2025-01-01",
      },
    },
  );
  expect(created.ok()).toBe(true);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/applications");
    const add = page.getByRole("button", {
      name: "Add application",
      exact: true,
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await add.click();
    await centeredDialog(page);
    await expect(add).toBeFocused();
    await page
      .getByRole("button", { name: "Edit Glass Dialog Test", exact: true })
      .click();
    await centeredDialog(page);
    await page
      .getByRole("button", { name: "Delete Glass Dialog Test", exact: true })
      .click();
    await centeredDialog(page, true);
    await page
      .getByRole("button", { name: "Review applications", exact: true })
      .click();
    await centeredDialog(page);
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Add event", exact: true }).click();
    await centeredDialog(page);
    await page.goto("/resumes");
    await page
      .getByRole("button", { name: "Upload resume", exact: true })
      .click();
    await centeredDialog(page);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Upload resume", exact: true })
    .click();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
});

test("review explains invalid inputs, prevents duplicate submissions and recovers from quota errors", async ({
  page,
}) => {
  await page.goto("/analysis");
  const run = page.getByRole("button", {
    name: "Run free review",
    exact: true,
  });
  await expect(run).toBeDisabled();
  await expect(
    page.getByText("Paste 20–40,000 characters of resume text.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Resume text", { exact: true })
    .fill("Built React interfaces and accessible web applications.");
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "We need React developers to build accessible web applications and test their work.",
    );
  await page
    .getByRole("button", { name: "Find requirements", exact: true })
    .click();
  const requirement = page.getByLabel("Requirement 1", { exact: true });
  await requirement.fill("   ");
  await expect(run).toBeDisabled();
  await requirement.fill("React");
  let requests = 0;
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/analyses", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    requests++;
    await pending;
    await route.fulfill({
      status: 429,
      json: { message: "Daily review limit reached. Try again later." },
    });
  });
  await run.click();
  await expect(
    page.getByRole("button", { name: "Reviewing…", exact: true }),
  ).toBeDisabled();
  expect(requests).toBe(1);
  finish();
  await expect(page.getByRole("alert")).toContainText(
    "Daily review limit reached",
  );
  await expect(page.getByLabel("Resume text", { exact: true })).toHaveValue(
    "Built React interfaces and accessible web applications.",
  );
  await expect(run).toBeEnabled();
});

test("plain-text rate limits explain when to retry", async ({ page }) => {
  await page.goto("/analysis");
  await page
    .getByLabel("Resume text", { exact: true })
    .fill("Built React interfaces and accessible web applications.");
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "We need React developers to build accessible web applications and test their work.",
    );
  await page
    .getByRole("button", { name: "Find requirements", exact: true })
    .click();
  await page.route("**/api/analyses", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 429,
          contentType: "text/plain",
          body: "Too many requests, please try again later.",
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Run free review", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Please wait a minute and try again",
  );
});
