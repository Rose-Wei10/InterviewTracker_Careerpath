import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("long application values stay bounded and expand by keyboard in both themes", async ({
  page,
}, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-browser-test-user": `table-${randomUUID()}`,
  });
  await page.goto("/applications");
  await page
    .getByRole("button", { name: "Add application", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    company = "Long Salary Labs",
    role = "Software Engineer " + "VeryLongUnbrokenRole".repeat(8),
    salary =
      "$180,000 yearly; bonus and equity. " + "LongSalaryDescription".repeat(3);
  await dialog.getByLabel("Company", { exact: false }).fill(company);
  await dialog.getByLabel("Role", { exact: false }).fill(role.slice(0, 200));
  await dialog.locator("input[name=salary]").fill(salary.slice(0, 100));
  await dialog
    .locator("input[name=location]")
    .fill("LongUnbrokenLocation".repeat(6));
  await dialog.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).not.toBeVisible();
  for (const width of [390, 768, 1440])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
        document.documentElement.dataset.theme = value;
      }, theme);
      const row = page
        .getByRole("row")
        .filter({
          has: page.getByRole("link", { name: company, exact: true }),
        });
      await expect(
        row.getByRole("button", { name: `Edit ${company}`, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const show = row.getByRole("button", {
        name: `Show full role for ${company}`,
        exact: true,
      });
      await expect(show).toBeVisible();
      await show.focus();
      await page.keyboard.press("Enter");
      await expect(row.locator(".table-text-full").first()).toHaveText(
        role.slice(0, 200),
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await row
        .getByRole("button", {
          name: `Hide full role for ${company}`,
          exact: true,
        })
        .press("Enter");
      await row
        .getByRole("button", {
          name: `Show full salary for ${company}`,
          exact: true,
        })
        .click();
      await expect(
        row.locator("[data-label=Salary] .table-text-full"),
      ).toHaveText(salary.slice(0, 100));
      await row
        .getByRole("button", {
          name: `Hide full salary for ${company}`,
          exact: true,
        })
        .click();
      await page.screenshot({
        path: testInfo.outputPath(`applications-${width}-${theme}.png`),
        fullPage: true,
      });
    }
});
