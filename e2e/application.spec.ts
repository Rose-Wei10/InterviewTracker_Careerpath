import { test, expect } from "@playwright/test";
test("application journey: create, detail, interview, status, search, export and delete", async ({
  page,
}) => {
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("company *", { exact: true }).fill("Portfolio Labs");
  await form.getByLabel("role *", { exact: true }).fill("Full Stack Engineer");
  await form.getByLabel("location", { exact: true }).fill("Remote");
  await form
    .getByLabel("Notes", { exact: true })
    .fill("Prepare examples of ownership checks.");
  await form.getByRole("button", { name: "Save application" }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("link", { name: "Portfolio Labs", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Portfolio Labs", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Schedule round" }).click();
  const round = page.getByRole("dialog");
  await round.getByLabel("Round name").fill("Technical conversation");
  await round
    .getByLabel("Date and time in selected zone")
    .fill("2026-12-01T10:00");
  await round.getByLabel("IANA time zone").fill("America/Los_Angeles");
  await round.getByRole("button", { name: "Schedule interview" }).click();
  await expect(round).not.toBeVisible();
  await expect(
    page.getByText("Technical conversation", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Application status", { exact: true })
    .selectOption("Interview");
  await expect(page.getByText(/status changed → Interview/i)).toBeVisible();
  await page.getByRole("link", { name: "Applications", exact: true }).click();
  await page.getByPlaceholder("Company or role…").fill("Portfolio Labs");
  await expect(
    page.getByRole("link", { name: "Portfolio Labs", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("applications.csv");
  await page
    .getByRole("button", { name: "Delete Portfolio Labs", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Portfolio Labs", exact: true }),
  ).not.toBeVisible();
});
test("dashboard, theme and mobile navigation remain usable", async ({
  page,
}) => {
  // Synthetic opportunities are persisted via the real API, never hardcoded dashboard statistics.
  const names = [
    "Maple Studio",
    "Cedar Systems",
    "Juniper Labs",
    "Willow Works",
    "Birch Software",
    "Elm Digital",
    "Aspen Cloud",
    "Oak Research",
    "Pine Robotics",
    "Sage Analytics",
    "Moss Platform",
    "Fern Health",
  ];
  const stages = [
    "Applied",
    "OA",
    "Interview",
    "Final Round",
    "Offer",
    "Reject",
    "Ghosted",
  ];
  let firstId = "";
  for (let i = 0; i < names.length; i++) {
    const response = await page.request.post(
      "http://127.0.0.1:5019/api/applications",
      {
        headers: { Authorization: "Bearer browser-test-token" },
        data: {
          company: names[i],
          role: i % 2 ? "Software Engineer Intern" : "Full Stack Engineer",
          appliedDate: new Date(Date.now() - i * 4 * 86400000).toISOString(),
          status: stages[i % stages.length],
          location: i % 2 ? "Remote" : "San Francisco",
          followUpAt:
            i < 2
              ? new Date(
                  Date.now() + (i === 0 ? -1 : 3) * 86400000,
                ).toISOString()
              : null,
        },
      },
    );
    expect(response.status()).toBe(201);
    if (i === 0) firstId = (await response.json()).id;
  }
  const scheduled = await page.request.post(
    `http://127.0.0.1:5019/api/applications/${firstId}/interviews`,
    {
      headers: { Authorization: "Bearer browser-test-token" },
      data: {
        title: "Technical conversation",
        startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        timeZone: "America/Los_Angeles",
        type: "video",
        reminderMinutes: 60,
      },
    },
  );
  expect(scheduled.status()).toBe(201);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Your job search, at a glance/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Total applications", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Light mode" }).click();
  await page.screenshot({
    path: "docs/screenshots/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("dashboard drill-down, follow-up editing, quick status and browser history", async ({
  page,
}) => {
  const headers = { Authorization: "Bearer browser-test-token" };
  const created = await page.request.post(
    "http://127.0.0.1:5019/api/applications",
    {
      headers,
      data: {
        company: "Action Center Labs",
        role: "UI Engineer",
        status: "Applied",
        appliedDate: "2000-01-05",
        followUpAt: new Date(Date.now() - 86400000).toISOString(),
      },
    },
  );
  expect(created.status()).toBe(201);
  const original = await created.json();
  const id = original.id;
  await page.goto("/dashboard");
  await expect(
    page.getByRole("link", { name: "Manage follow-up for Action Center Labs" }),
  ).toBeVisible();
  await page.getByLabel("Date range").selectOption("custom");
  await page.getByLabel("From", { exact: true }).fill("2000-01-01");
  await page.getByLabel("To", { exact: true }).fill("2000-01-31");
  await page.getByRole("link", { name: /^Total applications/ }).click();
  await expect(page).toHaveURL(/from=2000-01-01&to=2000-01-31/);
  await expect(
    page
      .locator(".application-table")
      .getByRole("link", { name: "Action Center Labs", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Status for Action Center Labs")
    .selectOption("Interview");
  await expect(page.getByLabel("Status for Action Center Labs")).toBeEnabled();
  await expect(page.getByLabel("Status for Action Center Labs")).toHaveValue(
    "Interview",
  );
  const search = page.getByPlaceholder("Company or role…");
  await search.fill("not-a-company");
  await expect(page.getByText(/No applications match/)).toBeVisible();
  await page.getByRole("button", { name: "Remove search filter" }).click();
  await expect(search).toHaveValue("");
  await expect(
    page
      .locator(".application-table")
      .getByRole("link", { name: "Action Center Labs", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(search).toHaveValue("not-a-company");
  await expect(page.getByText(/No applications match/)).toBeVisible();
  await page.goForward();
  await expect(search).toHaveValue("");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("link", { name: "Manage follow-up for Action Center Labs" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Edit application" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Notes", { exact: true })
    .fill("Follow-up stays at the original time.");
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).not.toBeVisible();
  const unchanged = await page.request.get(
    `http://127.0.0.1:5019/api/applications/${id}`,
    { headers },
  );
  expect((await unchanged.json()).followUpAt).toBe(original.followUpAt);
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  await page.getByLabel("Follow-up date (9am local)").fill("2031-02-03");
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).not.toBeVisible();
  const rescheduled = await page.request.get(
    `http://127.0.0.1:5019/api/applications/${id}`,
    { headers },
  );
  expect((await rescheduled.json()).followUpAt).toBe(
    await page.evaluate(() => new Date("2031-02-03T09:00:00").toISOString()),
  );
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  await page.getByLabel("Follow-up date (9am local)").fill("");
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).not.toBeVisible();
  const detail = await page.request.get(
    `http://127.0.0.1:5019/api/applications/${id}`,
    { headers },
  );
  expect((await detail.json()).followUpAt).toBeNull();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Manage follow-up for Action Center Labs" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /^Interview: / }).click();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("Interview");
});

test("all workspace pages fit mobile, tablet and desktop in both themes", async ({
  page,
}) => {
  // Browser-only fixtures exercise layout without contacting private storage or an AI provider.
  await page.route("**/api/resumes", (route) =>
    route.fulfill({
      json: [
        {
          id: "visual-resume",
          name: "Full Stack Resume",
          description: "Focused on React, APIs and PostgreSQL.",
          version: 2,
          size: 128000,
          createdAt: "2026-10-01",
        },
      ],
    }),
  );
  await page.route("**/api/analyses", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/analyses/config", (route) =>
    route.fulfill({
      json: {
        mode: "demo",
        dailyLimit: 10,
        providerOrigin: "local",
        model: "keyword-demo",
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator(".app").getAttribute("data-theme")) !== theme) {
        await page
          .getByRole("button", {
            name: theme === "dark" ? "Dark mode" : "Light mode",
          })
          .click();
      }
      for (const [label, path, heading] of [
        ["Applications", "applications", "Applications."],
        ["Interviews", "calendar", "Interview calendar."],
        ["Resumes", "resumes", "Resume library."],
        ["Match", "analysis", "Find your fit."],
        ["Overview", "dashboard", "Your job search, at a glance."],
      ]) {
        await page.getByRole("link", { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${path}$`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          heading,
        );
        await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(
          0,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        if (
          path !== "dashboard" &&
          ((width === 390 && theme === "dark") ||
            (width === 1440 && theme === "light"))
        ) {
          await page.screenshot({
            path: `docs/screenshots/${path}-${width}-${theme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Interviews", exact: true }).click();
  const rounds = await page.request.get(
    "http://127.0.0.1:5019/api/interviews",
    { headers: { Authorization: "Bearer browser-test-token" } },
  );
  const scheduled = (await rounds.json()).find(
    (item: { status: string }) => item.status === "Scheduled",
  );
  const localDate = await page.evaluate(
    (instant) => new Date(instant).toLocaleDateString("en-CA"),
    scheduled.startsAt,
  );
  await page.getByLabel("Month", { exact: true }).fill(localDate.slice(0, 7));
  await page
    .getByRole("button", { name: `Show interviews for ${localDate}` })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Selected day agenda" })
      .getByRole("link", { name: /Maple Studio/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Applications", exact: true }).click();
  const company = page
    .locator(".application-table")
    .getByRole("link", { name: "Maple Studio", exact: true });
  await company.click();
  await expect(
    page.getByRole("heading", { name: "Maple Studio", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const isDark =
    (await page.locator(".app").getAttribute("data-theme")) === "dark";
  expect(
    await dialog.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe(isDark ? "rgb(25, 33, 55)" : "rgb(255, 255, 255)");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit application", exact: true }),
  ).toBeFocused();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      if ((await page.locator(".app").getAttribute("data-theme")) !== theme) {
        await page
          .getByRole("button", {
            name: theme === "dark" ? "Dark mode" : "Light mode",
          })
          .click();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (
        (width === 390 && theme === "dark") ||
        (width === 1440 && theme === "light")
      ) {
        await page.screenshot({
          path: `docs/screenshots/detail-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});
