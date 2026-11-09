import { expect, test } from "@playwright/test";

test("review a synthetic Gmail update and open the existing calendar form", async ({
  page,
}) => {
  const item = {
    id: "email-1",
    account: "jobs@example.test",
    threadId: "thread-1",
    sender: "Recruiting <team@example.test>",
    subject: "Maple Studio interview invitation",
    receivedAt: new Date().toISOString(),
    category: "Interview",
    applicationId: "job-1",
  };
  const job = {
    id: "job-1",
    company: "Maple Studio",
    role: "Engineer",
    status: "Applied",
  };
  let items = [item];
  await page.route(/\/api\/email-updates(?:\/|$)/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/count"))
      return route.fulfill({ json: { pending: items.length } });
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toEqual({
        action: "link",
        applicationId: job.id,
      });
      items = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      json: {
        connection: { account: item.account, lastSyncedAt: null },
        pending: items.length,
        items,
      },
    });
  });
  await page.route(/\/api\/applications\?/, (route) =>
    route.fulfill({ json: { items: [job], total: 1 } }),
  );
  await page.route("**/api/applications/job-1", (route) =>
    route.fulfill({ json: job }),
  );
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Email updates (1)" }).click();
  await expect(page.getByText(item.subject)).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: /Change status/ }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Link and schedule" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Category")).toHaveValue(
    "Interview",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByText("No emails waiting for review.")).toBeVisible();
});
