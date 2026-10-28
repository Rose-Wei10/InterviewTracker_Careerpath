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
  await page.getByRole("button", { name: "+ Schedule event" }).click();
  const round = page.getByRole("dialog");
  await round
    .getByLabel("Title", { exact: true })
    .fill("Technical conversation");
  await round.getByLabel("Date", { exact: true }).fill("2026-12-01");
  await round.getByLabel("Time", { exact: true }).fill("10:00");
  await round.getByLabel("Time zone").fill("America/Los_Angeles");
  await round.getByRole("button", { name: "Add event" }).click();
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
    path: "test-results/preview/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Light mode" }).click();
  await page.screenshot({
    path: "test-results/preview/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("10-row pagination, review page selection and browser history", async ({
  page,
}) => {
  const headers = { Authorization: "Bearer browser-test-token" };
  for (let i = 0; i < 21; i++) {
    const r = await page.request.post(
      "http://127.0.0.1:5019/api/applications",
      {
        headers,
        data: {
          company: `Review Fixture ${String(i).padStart(2, "0")}`,
          role: "Engineer",
          appliedDate: "2000-01-05",
          status: "Applied",
        },
      },
    );
    expect(r.status()).toBe(201);
  }
  await page.goto(
    "/applications?search=Review+Fixture&sort=company&direction=asc",
  );
  const rows = page.locator(".application-table tbody tr");
  await expect(rows).toHaveCount(10);
  await expect(page.getByText("21 applications · Page 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("21 applications · Page 2 of 3")).toBeVisible();
  await expect(rows).toHaveCount(10);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("21 applications · Page 3 of 3")).toBeVisible();
  await expect(rows).toHaveCount(1);
  await page.goBack();
  await expect(page.getByText("21 applications · Page 2 of 3")).toBeVisible();
  await page
    .getByRole("button", { name: "Review applications", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("tbody tr")).toHaveCount(10);
  await dialog.getByLabel("Select this page", { exact: true }).check();
  await expect(dialog.getByText("10 selected", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Next review page" }).click();
  await expect(dialog.getByText("0 selected", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Previous review page" }).click();
  await expect(dialog.getByText("0 selected", { exact: true })).toBeVisible();
  await dialog
    .getByLabel("Select Review Fixture 00 Engineer", { exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Mark selected as Ghosted" })
    .click();
  await expect(dialog.getByText("0 selected", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByPlaceholder("Company or role…").fill("Review Fixture 00");
  await expect(page.getByLabel("Status for Review Fixture 00")).toHaveValue(
    "Ghosted",
  );
  await page.getByPlaceholder("Company or role…").fill("not-a-company");
  await expect(page.getByText(/No applications match/)).toBeVisible();
  await page.getByRole("button", { name: "Remove search filter" }).click();
  await expect(page.getByPlaceholder("Company or role…")).toHaveValue("");
  await page.goBack();
  await expect(page.getByPlaceholder("Company or role…")).toHaveValue(
    "not-a-company",
  );
});

test("shared event form syncs Calendar, application and Overview on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/applications?search=Maple+Studio");
  await page
    .getByRole("button", { name: "Schedule event for Maple Studio" })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Title", { exact: true }).fill("Shared OA deadline");
  await form.getByLabel("Category", { exact: true }).selectOption("OA");
  await form.getByLabel("All-day event").check();
  const date = await page.evaluate(() =>
    new Date().toLocaleDateString("en-CA"),
  );
  await form.getByLabel("Date", { exact: true }).fill(date);
  await expect(
    form.getByLabel("Also update application status to OA"),
  ).not.toBeChecked();
  await form.getByLabel("Also update application status to OA").check();
  await form.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByLabel("Status for Maple Studio")).toHaveValue("OA");
  await page.getByRole("link", { name: "Maple Studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit event Shared OA deadline" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: `Show events for ${date}` }).click();
  const agenda = page.getByRole("region", { name: "Selected day agenda" });
  await expect(
    agenda.getByRole("button", { name: "Edit event Shared OA deadline" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  const attention = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /Needs attention/ }) });
  await expect(
    attention.getByRole("button", { name: "Edit event Shared OA deadline" }),
  ).toBeVisible();
  await attention
    .getByRole("button", { name: "Edit event Shared OA deadline" })
    .click();
  await form.getByLabel("Notes", { exact: true }).fill("Bring scratch paper");
  await form.getByLabel("Date", { exact: true }).fill("2031-02-03");
  await form.getByRole("button", { name: "Save event" }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByLabel("Month", { exact: true }).fill("2031-02");
  await page
    .getByRole("button", { name: "Show events for 2031-02-03" })
    .click();
  await agenda
    .getByLabel("Status for Shared OA deadline")
    .selectOption("Completed");
  await expect(agenda.getByLabel("Status for Shared OA deadline")).toHaveValue(
    "Completed",
  );
  await page
    .getByRole("button", { name: "Add event on 2031-02-04", exact: true })
    .click();
  await expect(form.getByLabel("Date", { exact: true })).toHaveValue(
    "2031-02-04",
  );
  await form.getByLabel("Title", { exact: true }).fill("Standalone planning");
  await form.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(form).not.toBeVisible();
  await page
    .getByRole("button", { name: "Show events for 2031-02-04" })
    .click();
  await agenda
    .getByLabel("Status for Standalone planning")
    .selectOption("Cancelled");
  await expect(agenda.getByLabel("Status for Standalone planning")).toHaveValue(
    "Cancelled",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/preview/calendar-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await form.getByLabel("All-day event").uncheck();
  await form.getByLabel("Date", { exact: true }).fill("2030-03-10");
  await form.getByLabel("Time", { exact: true }).fill("02:30");
  await form
    .getByLabel("Time zone", { exact: true })
    .fill("America/Los_Angeles");
  await form.getByLabel("Title", { exact: true }).fill("Invalid DST hour");
  await form.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(
    page.getByText(/This time may be skipped by daylight saving/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(form).not.toBeVisible();
});

test("editing event notes preserves the original instant including repeated DST hours and seconds", async ({
  page,
}) => {
  const r = await page.request.post("http://127.0.0.1:5019/api/events", {
    headers: { Authorization: "Bearer browser-test-token" },
    data: {
      title: "Repeated hour original",
      category: "Interview",
      startsAt: "2030-11-03T09:30:27.123Z",
      timeZone: "America/Los_Angeles",
      allDay: false,
    },
  });
  expect(r.status()).toBe(201);
  const event = await r.json();
  await page.goto("/calendar");
  await page.getByLabel("Month", { exact: true }).fill("2030-11");
  await page
    .getByRole("button", {
      name: "Edit event Repeated hour original",
      exact: true,
    })
    .click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Notes", { exact: true })
    .fill("Keep the second occurrence and seconds");
  await form.getByRole("button", { name: "Save event" }).click();
  await expect(form).not.toBeVisible();
  const saved = await page.request.get(
    `http://127.0.0.1:5019/api/events/${event.id}`,
    { headers: { Authorization: "Bearer browser-test-token" } },
  );
  expect((await saved.json()).startsAt).toBe(event.startsAt);
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
        ["Calendar", "calendar", "Calendar."],
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
            path: `test-results/preview/${path}-${width}-${theme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
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
    .getByRole("button", { name: `Show events for ${localDate}` })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Selected day agenda" })
      .getByRole("button", { name: /Edit event Technical conversation/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Applications", exact: true }).click();
  await page.getByPlaceholder("Company or role…").fill("Maple Studio");
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
          path: `test-results/preview/detail-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
});
