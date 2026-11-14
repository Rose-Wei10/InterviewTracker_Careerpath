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
const recovery = await readFile(
  new URL("./fixtures/recovery.html", import.meta.url),
  "utf8",
);
const server = createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(
    req.url === "/recovery"
      ? recovery
      : req.url === "/frame"
        ? "<label>Last name<input></label>"
        : fixture,
  );
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
  // Exercise the recovery-specific controls in the real unpacked extension.
  await employer.goto(`http://127.0.0.1:${server.address().port}/recovery`);
  await restored.locator("#replace").click();
  await restored.locator("#bundle").fill(
    JSON.stringify({
      format: "careerpath-apply-kit",
      version: 1,
      careerpathOrigin: `http://127.0.0.1:${server.address().port}`,
      entries: [
        ...entries,
        {
          starterKey: null,
          prompt: "School location",
          answer: "Synthetic City",
          review: false,
        },
        {
          starterKey: null,
          prompt: "Start date",
          answer: "2026-11-13",
          review: false,
        },
        {
          starterKey: "graduation",
          prompt: "Graduation",
          answer: "January 2028",
          review: false,
        },
      ],
    }),
  );
  await restored.locator("#scan").click();
  await restored.getByText(/Scan complete|Partial scan finished/).waitFor();

  assert.equal(
    await restored.locator("#fields > details > summary").first().textContent(),
    "Ready to fill (4)",
  );
  await restored.getByText(/Possible duplicate employment fragments/).waitFor();
  const graduation = restored
    .locator("article")
    .filter({ has: restored.getByText("Graduation", { exact: true }) });
  assert((await graduation.textContent()).includes("Spring 2028"));
  assert(
    (await graduation.textContent()).includes(
      "Employer definition: Spring means Jan through March",
    ),
  );
  await restored.locator("#select-ready").click();
  assert.equal(
    await restored.locator("#count").textContent(),
    "4 fields will be filled",
  );
  await restored.locator("#fill").click();
  await restored.getByText(/Fill finished/).waitFor();
  assert.equal(
    await employer.locator("input[type=date]").first().inputValue(),
    "2026-11-13",
  );
  assert.equal(
    await employer.locator("#location").inputValue(),
    "Synthetic City",
  );
  assert.equal(
    await employer.locator("#shadow").locator("input").inputValue(),
    "Example",
  );
  assert.equal(
    await employer
      .locator("label")
      .filter({ hasText: "legal terms" })
      .locator("input")
      .isChecked(),
    false,
  );
  assert.equal(await employer.locator("select").inputValue(), "");
  await employer.locator("#load-frame").click();
  await restored
    .locator("#status")
    .filter({ hasText: "Form changed" })
    .waitFor({ timeout: 10000 });
  await restored.locator("#scan").click();
  await restored.getByText(/Scan complete|Partial scan finished/).waitFor();
  assert.equal(await restored.locator("#scan").isEnabled(), true);
  await restored.locator("#track > summary").click();
  await restored
    .locator("#submission-status")
    .selectOption("Submission in progress");
  assert.equal(await restored.locator("#record").isDisabled(), true);
  await restored
    .locator("#receipt-excerpt")
    .fill("Synthetic employer receipt: application received.");
  await restored
    .locator("#receipt-url")
    .fill(`http://127.0.0.1:${server.address().port}/receipt`);
  await restored.locator("#confirmed").check();
  assert.equal(
    await restored.locator("#submission-status").inputValue(),
    "Confirmed submitted",
  );
  await restored.evaluate(() => {
    document.querySelector("main").scrollTop = 0;
  });
  await restored.screenshot({ path: join(dir, "panel-recovery.png") });
  const opened = context.waitForEvent("page");
  await restored.locator("#record").click();
  const handoff = await opened;
  await handoff.waitForURL("**/applications?**");
  const handed = new URL(handoff.url());
  assert.equal(
    handed.searchParams.get("recordLink"),
    `http://127.0.0.1:${server.address().port}/recovery`,
  );
  assert.equal(
    JSON.parse(new URLSearchParams(handed.hash.slice(1)).get("receipt"))
      .excerpt,
    "Synthetic employer receipt: application received.",
  );
  console.log(
    `PASS: real unpacked extension import, all-frame scan, exact native choices, demographic review, read-back, close/reopen, navigation, 320/600px, dark theme, shadow controls, delayed menu, dates, seasons, employment warnings, delayed frame detection and receipt handoff. Screenshots: ${dir}`,
  );
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
}
