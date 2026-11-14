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
  vi.stubGlobal("setInterval", w.setInterval.bind(w));
  const executeScript = vi
    .fn()
    .mockResolvedValueOnce([
      {
        documentId: "doc",
        result: { url: "https://employer.test/apply", embeds: [], revision: 0 },
      },
    ])
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
  expect($("diagnostics").textContent).toBe("No tab scanned yet.");
  const onUpdated = chrome.tabs.onUpdated.addListener.mock.calls[0][0];
  onUpdated(
    1,
    { url: "https://www.linkedin.com/jobs/view/123456/" },
    { id: 1, url: "https://www.linkedin.com/jobs/view/123456/", active: true },
  );
  $("scan").click();
  await vi.waitFor(() =>
    expect($("fields").textContent).toContain("Exact option: Asian"),
  );
  expect($("job-link").value).toBe(
    "https://www.linkedin.com/jobs/view/123456/",
  );
  $("checklist").querySelector("input").click();
  expect($("count").textContent).toContain("0 fields");
  const override = $("fields").querySelector(
    '[aria-label="Application-only answer for Race"]',
  );
  override.value = "White";
  [...override.parentElement.querySelectorAll("button")]
    .find((button) => button.textContent === "Use for this application")
    .click();
  expect(storage.applyKit.entries[1].answer).toBe("Asian");
  expect($("fields").textContent).toContain("application-only override");
  $("select-ready").click();
  expect($("count").textContent).toContain("1 fields");
  expect($("fields").querySelectorAll("input[type=checkbox]")[1].checked).toBe(
    false,
  );
  $("submission-status").value = "Submission in progress";
  $("submission-status").dispatchEvent(new w.Event("change"));
  expect($("record").disabled).toBe(true);
  $("submission-status").value = "Confirmed submitted";
  $("submission-status").dispatchEvent(new w.Event("change"));
  expect($("record").disabled).toBe(true);
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

test("GPA maps to explicit brackets while overlapping ranges and narrower identity remain undecided", () => {
  expect(
    optionMatch(
      { kind: "select", label: "GPA", options: ["3.0+", "3.5+", "3.75+"] },
      "3.81",
    ),
  ).toBe("3.75+");
  expect(
    optionMatch(
      { kind: "select", label: "GPA", options: ["3.5–3.74", "3.75–4.0"] },
      "3.81",
    ),
  ).toBe("3.75–4.0");
  expect(
    optionMatch(
      { kind: "select", label: "GPA", options: ["3.5–3.75", "3.75–4.0"] },
      "3.75",
    ),
  ).toBeNull();
  expect(
    optionMatch(
      {
        kind: "select",
        label: "Race / Asian subgroup",
        options: ["East Asian", "South Asian"],
      },
      "Asian",
    ),
  ).toBeNull();
  expect(
    optionMatch(
      { kind: "select", label: "Graduation", options: ["December 2027"] },
      "January 2028",
    ),
  ).toBeNull();
});

test("targeted menu inspection opens only the requested empty control with keyboard fallback", async () => {
  const w = fixture(
    '<label>Country<input role="combobox" aria-controls="countries"></label><div id="countries"></div><label>Authorization<input role="combobox" aria-controls="auth"></label><div id="auth"></div>',
  );
  const menus = [...w.document.querySelectorAll("input")];
  const clicks = menus.map((el) => {
    const fn = vi.fn();
    el.addEventListener("click", fn);
    el.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown")
        w.document.getElementById(el.getAttribute("aria-controls")).innerHTML =
          '<div role="option">Available choice</div>';
    });
    return fn;
  });
  const signature = JSON.stringify(["Country", "combo", "", ""]);
  const scan = await formControls(null, { signature });
  expect(scan.fields[0].options).toEqual(["Available choice"]);
  expect(clicks[0]).toHaveBeenCalledOnce();
  expect(clicks[1]).not.toHaveBeenCalled();
  w.close();
});

test("upload diagnostics distinguish input identity, required status, filename and exposed errors", async () => {
  const w = fixture(
    '<label for="cv">Resume/CV*</label><input id="cv" name="resume" type="file" required aria-invalid="true" aria-errormessage="upload-error"><p id="upload-error" role="alert">Upload timed out. Retry.</p>',
  );
  Object.defineProperty(w.document.querySelector("input"), "files", {
    value: [{ name: "synthetic.pdf" }],
  });
  expect((await formControls()).uploads[0]).toMatchObject({
    label: "Resume/CV",
    inputId: "cv",
    inputName: "resume",
    required: true,
    filename: "synthetic.pdf",
    accepted: false,
    errors: ["Upload timed out. Retry."],
  });
  w.close();
});

test("Eightfold query text is not completed unless the selection survives blur and is exposed again", async () => {
  const { window: w } = new JSDOM(
    '<label>Authorization<input role="combobox" aria-controls="menu" aria-expanded="true" required></label><div id="menu"><div role="option">是</div></div>',
    { url: "https://netflix.eightfold.ai/careers/apply" },
  );
  w.HTMLElement.prototype.getClientRects = () => [{ width: 20 }];
  for (const key of [
    "document",
    "getComputedStyle",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "Event",
  ])
    vi.stubGlobal(key, w[key]);
  const input = w.document.querySelector("input"),
    option = w.document.querySelector("[role=option]");
  const scan = await formControls();
  option.onclick = () => {
    input.value = "是";
    input.setAttribute("aria-expanded", "false");
  };
  expect(
    (await formControls([request(scan.fields[0], "是", "是")]))[0].ok,
  ).toBe(false);
  input.value = "";
  const fresh = await formControls();
  option.onclick = () => {
    input.value = "是";
    input.setAttribute("aria-expanded", "false");
    option.setAttribute("aria-selected", "true");
  };
  expect(
    (await formControls([request(fresh.fields[0], "是", "是")]))[0].ok,
  ).toBe(true);
  w.close();
});

test("open shadow controls are discoverable, closed roots stay inaccessible and acknowledgments cannot be filled", async () => {
  const w = fixture(
    '<div id="open"></div><div id="closed"></div><label>I agree to the legal terms<input type="checkbox"></label>',
  );
  w.document.getElementById("open").attachShadow({ mode: "open" }).innerHTML =
    '<label for="name">Given name</label><input id="name">';
  w.document
    .getElementById("closed")
    .attachShadow({ mode: "closed" }).innerHTML =
    "<label>Closed field<input></label>";
  const scan = await formControls();
  expect(scan.fields.some((field) => field.label === "Given name")).toBe(true);
  expect(scan.fields.some((field) => field.label === "Closed field")).toBe(
    false,
  );
  const legal = scan.fields.find((field) =>
    field.manualReason?.includes("Legal"),
  );
  expect(legal).toBeTruthy();
  expect(
    (await formControls([request(legal, "Yes", legal.options[0])]))[0].ok,
  ).toBe(false);
  w.close();
});

test("native dates and explicit employer graduation seasons never alter an eligibility date", () => {
  expect(
    optionMatch(
      { kind: "text", inputType: "date", label: "Start date" },
      "2026-11-13",
    ),
  ).toBe("2026-11-13");
  expect(
    optionMatch(
      { kind: "text", inputType: "date", label: "Start date" },
      "2026-02-30",
    ),
  ).toBeNull();
  const field = {
    kind: "select",
    label: "Graduation",
    context: "Spring is Jan through March",
    options: ["Spring 2028", "Fall 2027"],
  };
  expect(optionMatch(field, "January 2028")).toBe("Spring 2028");
  expect(
    needsReview(field, {
      answer: "January 2028",
      review: false,
      prompt: "Graduation",
    }),
  ).toBe(true);
  expect(optionMatch({ ...field, context: "" }, "January 2028")).toBeNull();
  expect(
    optionMatch({ ...field, options: ["Spring 2027"] }, "January 2028"),
  ).toBeNull();
});

test("employment warnings identify duplicate fragments and inconsistent current-role dates without changing entries", async () => {
  const w = fixture(
    '<fieldset><legend>Employment</legend><label>Company<input value="Synthetic Co"></label><label>Job title<input value="Engineer"></label><label>End date<input value="2026-01-01"></label><label>Current role<input type="checkbox" checked></label></fieldset><fieldset><legend>Employment</legend><label>Company<input value="Synthetic Co"></label><label>Job title<input value="Engineer"></label><label>Start date<input required></label></fieldset>',
  );
  const before = [...w.document.querySelectorAll("input")].map((el) => [
    el.value,
    el.checked,
  ]);
  const scan = await formControls();
  expect(scan.warnings.some((value) => value.includes("duplicate"))).toBe(true);
  expect(
    scan.warnings.some((value) => value.includes("missing required")),
  ).toBe(true);
  expect(
    scan.warnings.some((value) => value.includes("current-role flag")),
  ).toBe(true);
  expect(
    [...w.document.querySelectorAll("input")].map((el) => [
      el.value,
      el.checked,
    ]),
  ).toEqual(before);
  w.close();
});
