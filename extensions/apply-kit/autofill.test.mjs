import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { JSDOM } from "jsdom";
import { applicationFields } from "./fields.mjs";
import { needsReview, parseBundle, suggestions } from "./match.mjs";

afterEach(() => vi.unstubAllGlobals());
const entries = [
  {
    starterKey: "first-name",
    prompt: "Legal first name",
    answer: "Alex",
    review: false,
  },
  {
    starterKey: null,
    prompt:
      "Describe a project you’re proud of. What did you personally build?",
    answer: "A demo.",
    review: false,
  },
];

test("parses a versioned bundle and matches aliases and rephrased questions", () => {
  expect(
    parseBundle(
      JSON.stringify({ format: "careerpath-apply-kit", version: 1, entries }),
    ),
  ).toEqual(entries);
  expect(() => parseBundle('{"version":2}')).toThrow();
  expect(suggestions({ label: "Given name" }, entries).suggested).toBe(0);
  expect(
    suggestions(
      { label: "Tell us about a technical project you’re proud of" },
      entries,
    ).suggested,
  ).toBe(1);
  expect(
    suggestions({ label: "Given name" }, [entries[0], entries[0]]).suggested,
  ).toBeNull();
  expect(needsReview({ label: "Expected salary" }, entries[0])).toBe(true);
});

test("fills only approved unchanged fields and rescans a new step without submitting", () => {
  const { window } = new JSDOM(`<form>
    <label>Given name<input></label><label>Existing<input value="Keep"></label>
    <label>Card number<input></label><fieldset><legend>Payment by credit card</legend><label>Number<input></label></fieldset><label>Password<input type="password"></label>
    <label>Resume<input type="file"></label><label hidden>Hidden<input></label>
    <label>About you<textarea></textarea></label><button>Submit</button>
  </form>`);
  window.HTMLElement.prototype.getClientRects = () => [{ width: 20 }];
  for (const name of [
    "document",
    "getComputedStyle",
    "HTMLTextAreaElement",
    "HTMLInputElement",
    "Event",
  ])
    vi.stubGlobal(name, window[name]);
  const submitted = vi.fn();
  window.document.querySelector("form").addEventListener("submit", submitted);
  const [first, about] = applicationFields();
  expect(applicationFields().map(({ label }) => label)).toEqual([
    "Given name",
    "About you",
  ]);
  window.document.querySelector("textarea").value = "Typed while reviewing";
  expect(
    applicationFields([
      { ...first, value: "Alex" },
      { ...about, value: "Overwrite" },
    ]),
  ).toBe(1);
  expect(window.document.querySelector("textarea").value).toBe(
    "Typed while reviewing",
  );
  window.document.querySelector("form").innerHTML =
    "<label>Next step<input></label>";
  const [step] = applicationFields();
  const input = window.document.querySelector("input");
  input.replaceWith(input.cloneNode());
  expect(applicationFields([{ ...step, value: "Stale" }])).toBe(0);
  expect(applicationFields().map(({ label }) => label)).toEqual(["Next step"]);
  expect(submitted).not.toHaveBeenCalled();
  window.close();
});

test("recognizes employer aliases while leaving bare Location undecided", () => {
  const data = [
    { starterKey: "city", prompt: "City" },
    { starterKey: "locations", prompt: "Preferred locations" },
    { starterKey: "linkedin", prompt: "LinkedIn" },
    { starterKey: "portfolio", prompt: "Portfolio" },
    entries[0],
  ];
  expect(suggestions({ label: "Location" }, data)).toEqual({
    choices: [0, 1],
    suggested: null,
  });
  expect(suggestions({ label: "Location (City)" }, data).suggested).toBe(0);
  expect(suggestions({ label: "LinkedIn Link" }, data).suggested).toBe(2);
  expect(suggestions({ label: "Website link" }, data).suggested).toBe(3);
  expect(
    suggestions({ label: "Contact", autocomplete: "given-name" }, data)
      .suggested,
  ).toBe(4);
});

test("reports Greenhouse embeds and never writes custom controls", () => {
  const { window } =
    new JSDOM(`<div><span>Location</span><div><input aria-label="Search" role="combobox"></div></div>
    <label>Pronouns<input aria-label="Search" role="combobox"></label>
    <label>Email<input value="existing@example.test"></label>
    <iframe src="https://job-boards.greenhouse.io.example.test/fake"></iframe>
    <iframe src="https://job-boards.greenhouse.io/embed/job_app?token=123"></iframe>`);
  window.HTMLElement.prototype.getClientRects = () => [{ width: 20 }];
  for (const name of [
    "document",
    "getComputedStyle",
    "HTMLInputElement",
    "Event",
  ])
    vi.stubGlobal(name, window[name]);
  const report = applicationFields(null, true);
  expect(report).toMatchObject({
    fields: [
      { label: "Location", manual: "choice" },
      { label: "Pronouns", manual: "demographic" },
    ],
    filled: 1,
    embedded: true,
    greenhouse: "https://job-boards.greenhouse.io/embed/job_app?token=123",
  });
  expect(
    applicationFields([{ ...report.fields[0], value: "Example City" }]),
  ).toBe(0);
  expect(window.document.querySelector("input").value).toBe("");
  window.close();
});

test("popup hides imported data, groups fields, and sends only checked answers", async () => {
  const { window } = new JSDOM(
    readFileSync(new URL("./popup.html", import.meta.url), "utf8"),
  );
  vi.stubGlobal("document", window.document);
  const executeScript = vi
    .fn()
    .mockResolvedValueOnce([
      {
        documentId: "fixture",
        result: {
          fields: [
            { label: "Given name", index: 0, signature: "name" },
            {
              label: "Location",
              index: 1,
              signature: "location",
              manual: "choice",
            },
          ],
          filled: 2,
        },
      },
    ])
    .mockResolvedValueOnce([{ result: 1 }]);
  vi.stubGlobal("chrome", {
    tabs: {
      query: async () => [
        { id: 1, url: "https://employer.example.test/apply" },
      ],
    },
    scripting: { executeScript },
  });
  await import("./popup.mjs");
  const find = (id) => window.document.getElementById(id);
  find("bundle").value = JSON.stringify({
    format: "careerpath-apply-kit",
    version: 1,
    entries,
  });
  find("bundle").dispatchEvent(new window.Event("input"));
  expect(find("import").hidden).toBe(true);
  expect(find("bundle").value).toBe("");
  expect(find("summary").textContent).toContain("2 saved answers");
  find("scan").click();
  await vi.waitFor(() =>
    expect(find("fields").textContent).toContain("Complete on the form"),
  );
  expect(find("status").textContent).toContain("2 already filled");
  expect(find("fill").disabled).toBe(true);
  window.document.querySelector('input[type="checkbox"]').click();
  expect(find("count").textContent).toBe("1 selected");
  find("fill").click();
  await vi.waitFor(() =>
    expect(find("status").textContent).toContain("Filled 1 of 1"),
  );
  expect(executeScript.mock.calls[1][0].args).toEqual([
    [{ index: 0, signature: "name", value: "Alex" }],
  ]);
  window.close();
});
