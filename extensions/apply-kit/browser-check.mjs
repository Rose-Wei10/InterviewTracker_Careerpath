// Isolated synthetic extension journey; never connects to an employer or uses saved answers.
import { chromium } from "@playwright/test";
import { mkdtemp, cp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "careerpath-kit-"));
const extension = join(dir, "extension");
await cp(resolve("extensions/apply-kit"), extension, { recursive: true });
const manifest = JSON.parse(
  await readFile(join(extension, "manifest.json"), "utf8"),
);
manifest.host_permissions = ["http://127.0.0.1/*"];
await writeFile(join(extension, "manifest.json"), JSON.stringify(manifest));
const fixture = `<!doctype html><title>Synthetic application</title><form><label>Given name<input></label><label>Country<select><option value="">Choose</option><option>United States</option></select></label><fieldset><legend>Race</legend><label><input type="radio" name="race">Asian</label><label><input type="radio" name="race">White</label></fieldset><iframe src="/frame"></iframe><label>Résumé<input type="file"></label><button>Submit</button></form>`;
const server = createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(req.url === "/frame" ? "<label>Last name<input></label>" : fixture);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let context;
try {
  context = await chromium.launchPersistentContext(join(dir, "profile"), {
    headless: true,
    channel: "chromium",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const manager = await context.newPage();
  await manager.goto("chrome://extensions");
  const id = await manager
    .locator("extensions-item")
    .first()
    .getAttribute("id");
  const employer = await context.newPage();
  await employer.goto(`http://127.0.0.1:${server.address().port}/apply`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${id}/panel.html`);
  await employer.bringToFront();
  const entries = [
    {
      starterKey: "first-name",
      prompt: "Legal first name",
      answer: "Alex",
      review: false,
    },
    {
      starterKey: "last-name",
      prompt: "Legal last name",
      answer: "Example",
      review: false,
    },
    {
      starterKey: "country",
      prompt: "Country",
      answer: "United States",
      review: false,
    },
    { starterKey: null, prompt: "Race", answer: "Asian", review: false },
  ];
  await panel
    .locator("#bundle")
    .fill(
      JSON.stringify({ format: "careerpath-apply-kit", version: 1, entries }),
    );
  await panel.locator("#scan").click();
  await panel.getByText("Ready to fill (3)", { exact: true }).waitFor();
  await panel.locator("#select-ready").click();
  assert.equal(
    await panel.locator("#count").textContent(),
    "3 fields will be filled",
  );
  await panel.locator("#fill").click();
  await panel.getByText("Completed (3)", { exact: true }).waitFor();
  assert.equal(await employer.locator("input").first().inputValue(), "Alex");
  assert.equal(await employer.locator("select").inputValue(), "United States");
  assert.equal(
    await employer.frameLocator("iframe").locator("input").inputValue(),
    "Example",
  );
  assert.equal(await employer.locator("input[name=race]:checked").count(), 0);
  await panel.close();
  const restored = await context.newPage();
  await restored.goto(`chrome-extension://${id}/panel.html`);
  await employer.bringToFront();
  await restored.locator("#scan").click();
  await restored.getByText("Completed (3)", { exact: true }).waitFor();
  for (const width of [320, 600]) {
    await restored.setViewportSize({ width, height: 800 });
    assert(
      await restored.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await restored.screenshot({ path: join(dir, `panel-${width}.png`) });
  }
  await restored.emulateMedia({ colorScheme: "dark" });
  await restored.screenshot({ path: join(dir, "panel-dark.png") });
  await employer.goto(`http://127.0.0.1:${server.address().port}/next`);
  await restored.locator("#scan").click();
  await restored.getByText("Ready to fill (3)", { exact: true }).waitFor();
  assert.equal(
    await restored.locator("#count").textContent(),
    "0 fields will be filled",
  );
  console.log(
    `PASS: real unpacked extension import, all-frame scan, exact native choices, demographic review, read-back, close/reopen, navigation, 320/600px and dark theme. Screenshots: ${dir}`,
  );
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}
