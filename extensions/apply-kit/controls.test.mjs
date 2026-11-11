import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { test, expect, vi, afterEach } from "vitest";
import { formControls } from "./controls.mjs";
import { optionMatch, suggestions, needsReview } from "./match.mjs";
afterEach(() => vi.unstubAllGlobals());
function fixture(html) {
  const { window } = new JSDOM(html);
  window.HTMLElement.prototype.getClientRects = () => [{ width: 20 }];
  for (const key of [
    "document",
    "getComputedStyle",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "Event",
  ])
    vi.stubGlobal(key, window[key]);
  return window;
}
const request = (field, value, option = null) => ({
  ...field,
  value,
  option,
  before: field.current,
});
test("matches only options within the current question and separates address components", () => {
  expect(
    optionMatch(
      { kind: "select", label: "Race", options: ["White", "Asian"] },
      "Asian",
    ),
  ).toBe("Asian");
  expect(
    optionMatch(
      {
        kind: "select",
        label: "Veteran status",
        options: ["I am not a protected veteran", "Protected veteran"],
      },
      "Not a protected veteran",
    ),
  ).toBe("I am not a protected veteran");
  expect(
    optionMatch(
      {
        kind: "radio",
        label: "Disability",
        options: ["Yes", "No, I do not have a disability"],
      },
      "No disability",
    ),
  ).toBe("No, I do not have a disability");
  expect(
    optionMatch(
      { kind: "select", label: "Eligibility", options: ["Yes", "Yes"] },
      "Yes",
    ),
  ).toBeNull();
  const entries = [
    { starterKey: "postal", prompt: "Postal code", answer: "98101" },
    { starterKey: "country", prompt: "Country", answer: "United States" },
  ];
  expect(suggestions({ label: "Country code" }, entries).choices).toEqual([]);
  expect(suggestions({ label: "State" }, entries).choices).toEqual([]);
  expect(
    needsReview(
      { label: "Consent to terms" },
      { prompt: "Consent", review: false },
    ),
  ).toBe(true);
});
test("native select, separate Yes/No radio groups and checkbox choices are read back", async () => {
  const w = fixture(
    `<label>Country<select required><option value="">Choose</option><option value="US">United States</option></select></label><fieldset><legend>Work authorization</legend><label><input type="radio" name="auth" value="yes">Yes</label><label><input type="radio" name="auth" value="no">No</label></fieldset><fieldset><legend>Sponsorship</legend><label><input type="radio" name="sponsor">Yes</label><label><input type="radio" name="sponsor">No</label></fieldset><fieldset><legend>Race</legend><label><input type="checkbox">Asian</label><label><input type="checkbox">White</label></fieldset>`,
  );
  const scan = await formControls();
  expect(scan.fields.map((f) => f.label)).toEqual([
    "Country",
    "Work authorization",
    "Sponsorship",
    "Race",
  ]);
  const result = await formControls(
    scan.fields.map((f, i) =>
      request(f, "unused", ["United States", "Yes", "No", "Asian"][i]),
    ),
  );
  expect(result.every((r) => r.ok)).toBe(true);
  expect(w.document.querySelector("input[name=auth]").checked).toBe(true);
  expect(w.document.querySelectorAll("input[name=sponsor]")[1].checked).toBe(
    true,
  );
  w.close();
});
test("preserves manual edits, rejects replaced controls and form-rejected values", async () => {
  const w = fixture(
    '<label>Name<input></label><label>Email<input type="email"></label>',
  );
  const { fields } = await formControls();
  w.document.querySelector("input").value = "Manual";
  expect((await formControls([request(fields[0], "Alex")]))[0].ok).toBe(false);
  expect((await formControls([request(fields[1], "invalid")]))[0].ok).toBe(
    false,
  );
  const scan = await formControls();
  const el = w.document.querySelector("input");
  el.replaceWith(el.cloneNode());
  expect((await formControls([request(scan.fields[0], "Alex")]))[0].ok).toBe(
    false,
  );
  w.close();
});
test("custom autocomplete waits for the approved exact option and requires commitment", async () => {
  const w = fixture(
    '<label>Country<input role="combobox" aria-controls="choices" aria-expanded="true"></label><div id="choices"><div role="option">United States</div></div>',
  );
  const scan = await formControls();
  const option = w.document.querySelector("[role=option]");
  option.addEventListener("click", () => {
    const input = w.document.querySelector("input");
    input.value = "United States";
    input.setAttribute("aria-expanded", "false");
  });
  option.remove();
  w.document
    .querySelector("input")
    .addEventListener("click", () =>
      setTimeout(
        () => w.document.querySelector("#choices").append(option),
        150,
      ),
    );
  expect(
    (
      await formControls([
        request(scan.fields[0], "United States", "United States"),
      ])
    )[0].ok,
  ).toBe(true);
  w.document.querySelector("input").value = "";
  w.document.querySelector("input").setAttribute("aria-expanded", "true");
  const fresh = await formControls();
  option.replaceWith(option.cloneNode(true));
  expect(
    (
      await formControls([
        request(fresh.fields[0], "United States", "United States"),
      ])
    )[0].ok,
  ).toBe(false);
  w.close();
});
test("reports frames and uploads without claiming backend acceptance", async () => {
  const w = fixture(
    '<iframe src="https://job-boards.greenhouse.io/embed/test"></iframe><iframe src="https://jobs.ashbyhq.com/embed/test"></iframe><label>Résumé<input type="file" aria-invalid="true"></label>',
  );
  const file = w.document.querySelector("input");
  Object.defineProperty(file, "files", { value: [{ name: "synthetic.pdf" }] });
  const scan = await formControls();
  expect(scan.frames).toHaveLength(2);
  expect(scan.uploads[0]).toMatchObject({
    filename: "synthetic.pdf",
    accepted: false,
  });
  w.close();
});
test("side panel imports, previews, keeps manual reminders separate and restores session", async () => {
  const { window: w } = new JSDOM(
    readFileSync(new URL("./panel.html", import.meta.url), "utf8"),
    { url: "https://extension.test" },
  );
  vi.stubGlobal("document", w.document);
  const entries = [
    {
      starterKey: "first-name",
      prompt: "Legal first name",
      answer: "Alex",
      review: false,
    },
    { starterKey: null, prompt: "Race", answer: "Asian", review: false },
  ];
  const storage = {};
  const executeScript = vi
    .fn()
    .mockResolvedValueOnce([
      {
        documentId: "doc",
        frameId: 0,
        result: {
          fields: [
            {
              index: 0,
              label: "Given name",
              kind: "text",
              signature: "name",
              current: "",
              options: [],
            },
            {
              index: 1,
              label: "Race",
              kind: "select",
              signature: "race",
              current: "",
              options: ["Asian", "White"],
              demographic: true,
            },
          ],
          frames: [],
          uploads: [],
        },
      },
    ])
    .mockResolvedValueOnce([
      { result: [{ index: 0, ok: true, value: "Alex" }] },
    ]);
  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: async () => storage,
        set: async (value) => Object.assign(storage, structuredClone(value)),
        remove: async () => {},
      },
    },
    tabs: {
      query: async () => [
        { id: 1, url: "https://employer.test/apply", title: "Test job" },
      ],
      onActivated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
    },
    scripting: { executeScript },
  });
  await import("./panel.mjs");
  const $ = (id) => w.document.getElementById(id);
  $("bundle").value = JSON.stringify({
    format: "careerpath-apply-kit",
    version: 1,
    entries,
  });
  $("bundle").dispatchEvent(new w.Event("input"));
  await vi.waitFor(() =>
    expect($("summary").textContent).toContain("2 saved answers"),
  );
  $("scan").click();
  await vi.waitFor(() =>
    expect($("fields").textContent).toContain("Exact option: Asian"),
  );
  $("checklist").querySelector("input").click();
  expect($("count").textContent).toContain("0 fields");
  $("select-ready").click();
  expect($("count").textContent).toContain("1 fields");
  expect($("fields").querySelectorAll("input[type=checkbox]")[1].checked).toBe(
    false,
  );
  $("fill").click();
  await vi.waitFor(() =>
    expect($("fields").textContent).toContain("Verified current value: Alex"),
  );
  expect(storage.applyKit.entries).toHaveLength(2);
  expect(
    storage.applyKit.pages["1:https://employer.test/apply"].results,
  ).toBeTruthy();
  w.close();
});
