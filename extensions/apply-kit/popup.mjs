import { applicationFields } from "./fields.mjs";
import { needsReview, parseBundle, suggestions } from "./match.mjs";

const byId = (id) => document.getElementById(id);
const bundle = byId("bundle"),
  scan = byId("scan"),
  fill = byId("fill");
const fields = byId("fields"),
  status = byId("status");
let session;
let rows = [];

function updateCount() {
  const count = rows.filter(({ approval }) => approval.checked).length;
  byId("count").textContent = `${count} selected`;
  fill.disabled = !count;
}

function clearResults() {
  rows = [];
  fields.replaceChildren();
  updateCount();
}

function render(field, entries, groups) {
  const { suggested, choices } = suggestions(field, entries);
  const review = suggested === null || needsReview(field, entries[suggested]);
  const group = groups[field.manual ? 2 : review ? 1 : 0];
  const row = document.createElement("article");
  row.className = "card";
  const title = document.createElement("strong");
  title.className = "row-title";
  title.textContent = field.label;
  row.append(title);
  group.append(row);
  if (field.manual === "demographic") {
    const message = document.createElement("p");
    message.textContent = "Choose your response on the application form.";
    row.append(message);
    return;
  }

  let selected = suggested;
  const answer = document.createElement("p");
  answer.className = "answer";
  const fullAnswer = document.createElement("details");
  const fullLabel = document.createElement("summary");
  fullLabel.textContent = "Read full answer";
  const fullText = document.createElement("p");
  fullText.className = "answer";
  fullAnswer.append(fullLabel, fullText);
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const approval = document.createElement("input");
  approval.type = "checkbox";
  approval.addEventListener("change", updateCount);
  const approveLabel = document.createElement("label");
  const caption = document.createTextNode("");
  approveLabel.append(approval, caption);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    if (selected === null) return;
    try {
      await navigator.clipboard.writeText(entries[selected].answer);
      status.textContent = "Copied. Choose the matching option on the form.";
    } catch {
      answer.textContent = entries[selected].answer;
      status.textContent =
        "Clipboard unavailable. Select and copy the answer text.";
    }
  });
  const browser = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Browse saved answers";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Find an answer";
  search.setAttribute("aria-label", `Find an answer for ${field.label}`);
  const options = document.createElement("div");
  options.className = "choice-list";
  const order = [...new Set([...choices, ...entries.keys()])];
  function renderOptions() {
    options.replaceChildren();
    const term = search.value.trim().toLowerCase();
    for (const index of order) {
      const entry = entries[index];
      if (!entry.prompt.toLowerCase().includes(term)) continue;
      const option = document.createElement("button");
      option.type = "button";
      option.className = "answer-choice";
      option.textContent = entry.prompt;
      option.addEventListener("click", () => {
        selected = index;
        browser.open = false;
        summary.focus();
        update();
      });
      options.append(option);
    }
    if (!options.childElementCount)
      options.textContent = "No saved answers match.";
  }
  search.addEventListener("input", renderOptions);
  browser.addEventListener("toggle", () => {
    if (browser.open) renderOptions();
  });
  browser.append(summary, search, options);
  function update() {
    const entry = selected === null ? null : entries[selected];
    answer.textContent = entry
      ? entry.answer.length > 140
        ? `${entry.answer.slice(0, 140)}…`
        : entry.answer
      : field.manual
        ? "Choose a saved answer to copy, then select an option on the form."
        : "Choose a saved answer to preview.";
    fullAnswer.hidden = !(entry?.answer.length > 140);
    fullAnswer.open = false;
    fullText.textContent = entry?.answer ?? "";
    approval.checked = false;
    approval.disabled = !entry;
    const needsConfirmation = entry && (review || needsReview(field, entry));
    caption.textContent = needsConfirmation
      ? " I reviewed this answer"
      : " Fill this field";
    approval.setAttribute(
      "aria-label",
      `${caption.textContent.trim()}: ${field.label}`,
    );
    copy.textContent =
      entry?.starterKey === "city" ? "Copy city" : "Copy answer";
    copy.hidden = !entry;
    updateCount();
  }
  actions.append(field.manual ? copy : approveLabel);
  row.append(answer, fullAnswer, actions, browser);
  update();
  if (!field.manual)
    rows.push({
      field,
      approval,
      get value() {
        return entries[selected]?.answer;
      },
    });
}

function load(entries) {
  session = { entries };
  bundle.value = "";
  byId("import").hidden = true;
  byId("loaded").hidden = false;
  byId("summary").textContent =
    `Apply Kit loaded · ${entries.length} saved answers`;
}

byId("replace").addEventListener("click", () => {
  session = undefined;
  clearResults();
  byId("loaded").hidden = true;
  byId("import").hidden = false;
  status.textContent = "";
  bundle.focus();
});
bundle.addEventListener("input", () => {
  if (!bundle.value.trim()) return;
  try {
    const entries = parseBundle(bundle.value);
    if (!entries.length)
      throw new Error("Save at least one answer in Apply Kit.");
    load(entries);
    status.textContent = "Ready to scan this page.";
    scan.focus();
  } catch {
    status.textContent = "Paste a valid autofill bundle from Careerpath.";
  }
});

scan.addEventListener("click", async () => {
  clearResults();
  if (!session) {
    status.textContent = "Paste saved answers from Careerpath first.";
    return;
  }
  scan.disabled = true;
  byId("replace").disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url ?? ""))
      throw new Error("Open an application page and try again.");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: applicationFields,
      args: [null, true],
    });
    Object.assign(session, {
      tabId: tab.id,
      documentId: result.documentId,
      url: tab.url,
    });
    const { fields: matches, filled, embedded, greenhouse } = result.result;
    const groups = [
      "Ready to fill",
      "Needs review",
      "Complete on the form",
    ].map((heading) => {
      const section = document.createElement("section");
      const title = document.createElement("h2");
      title.textContent = heading;
      section.append(title);
      return section;
    });
    matches.forEach((field) => render(field, session.entries, groups));
    fields.append(...groups.filter((group) => group.childElementCount > 1));
    if (greenhouse) {
      const link = document.createElement("a");
      link.href = greenhouse;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open Greenhouse application";
      fields.append(link);
    }
    status.textContent = greenhouse
      ? "This form is embedded. Open Greenhouse and scan again."
      : embedded && !matches.length
        ? "This embedded form needs manual entry."
        : matches.length
          ? `${matches.length} empty fields found. ${filled} already filled and skipped.`
          : filled
            ? `${filled} supported fields are already filled.`
            : "No supported empty fields found.";
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "Unable to scan this page.";
  } finally {
    scan.disabled = false;
    byId("replace").disabled = false;
  }
});

fill.addEventListener("click", async () => {
  const current = session;
  if (!current?.documentId) return;
  const approved = rows
    .filter(({ approval }) => approval.checked)
    .map(({ field, value }) => ({
      index: field.index,
      signature: field.signature,
      value,
    }));
  if (!approved.length) return;
  scan.disabled = true;
  fill.disabled = true;
  byId("replace").disabled = true;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== current.tabId || tab.url !== current.url)
      throw new Error("The application page changed.");
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
    scan.disabled = false;
    byId("replace").disabled = false;
    clearResults();
    scan.focus();
  }
});
