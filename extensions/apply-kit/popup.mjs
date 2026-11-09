import { applicationFields } from "./fields.mjs";
import { needsReview, parseBundle, suggestions } from "./match.mjs";

const bundle = document.querySelector("#bundle");
const scan = document.querySelector("#scan");
const fill = document.querySelector("#fill");
const fields = document.querySelector("#fields");
const status = document.querySelector("#status");
let session;
let rows = [];

function render(field, entries) {
  const { suggested } = suggestions(field, entries);
  const row = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = field.label;
  const picker = document.createElement("select");
  picker.setAttribute("aria-label", `Answer for ${field.label}`);
  picker.add(new Option("Choose a saved answer", ""));
  entries.forEach((entry, index) =>
    picker.add(new Option(entry.prompt, String(index))),
  );
  picker.value = suggested === null ? "" : String(suggested);
  const preview = document.createElement("p");
  preview.className = "answer";
  const approval = document.createElement("input");
  approval.type = "checkbox";
  const label = document.createElement("label");
  const caption = document.createTextNode("");
  label.append(approval, caption);
  function update() {
    const entry = picker.value === "" ? null : entries[Number(picker.value)];
    preview.textContent =
      entry?.answer ?? "Choose a saved answer to preview it.";
    approval.checked = false;
    approval.disabled = !entry;
    caption.textContent =
      entry && needsReview(field, entry)
        ? " I reviewed this answer for this application"
        : " Fill this field";
  }
  picker.addEventListener("change", update);
  update();
  row.append(legend, picker, preview, label);
  fields.append(row);
  return { field, picker, approval };
}

bundle.addEventListener("input", () => {
  session = undefined;
  rows = [];
  fields.replaceChildren();
  fill.disabled = true;
});

scan.addEventListener("click", async () => {
  bundle.disabled = true;
  scan.disabled = true;
  fill.disabled = true;
  fields.replaceChildren();
  rows = [];
  try {
    const entries = bundle.value.trim()
      ? parseBundle(bundle.value)
      : session?.entries;
    if (!entries?.length)
      throw new Error("Paste saved answers from Careerpath first.");
    bundle.value = "";
    session = { entries };
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url ?? ""))
      throw new Error("Open an application page and try again.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applicationFields,
    });
    session = {
      entries,
      tabId: tab.id,
      documentId: result.documentId,
      url: tab.url,
    };
    rows = result.result.map((field) => render(field, entries));
    status.textContent = rows.length
      ? "Review the suggestions and select fields to fill."
      : "No supported empty fields found.";
    fill.disabled = rows.length === 0;
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Unable to scan this page.";
  } finally {
    bundle.disabled = false;
    scan.disabled = false;
  }
});

fill.addEventListener("click", async () => {
  const current = session;
  if (!current?.documentId) return;
  const approved = rows
    .filter(({ approval }) => approval.checked)
    .map(({ field, picker }) => ({
      index: field.index,
      signature: field.signature,
      value: current.entries[Number(picker.value)].answer,
    }));
  if (!approved.length) {
    status.textContent = "Select at least one field first.";
    return;
  }
  bundle.disabled = true;
  scan.disabled = true;
  fill.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== current.tabId || tab.url !== current.url)
      throw new Error("The application page changed. Scan it again.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: current.tabId, documentIds: [current.documentId] },
      func: applicationFields,
      args: [approved],
    });
    status.textContent = `Filled ${result.result} of ${approved.length} selected fields. Review the form before submitting.`;
  } catch {
    status.textContent =
      "The page changed or could not be filled. Scan it again.";
  } finally {
    bundle.disabled = false;
    scan.disabled = false;
    fields.replaceChildren();
    rows = [];
  }
});
