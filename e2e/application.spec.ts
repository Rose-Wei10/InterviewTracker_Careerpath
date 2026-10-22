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
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Light mode" }).click();
  await page.screenshot({
    path: "docs/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
});
