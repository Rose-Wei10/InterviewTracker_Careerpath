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
